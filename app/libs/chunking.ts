import * as cheerio from 'cheerio';

export type Chunk = {
	id: string;
	content: string;
	metadata: {
		source: string;
		chunkIndex: number;
		totalChunks: number;
		startChar: number;
		endChar: number;
		[key: string]: string | number | boolean | string[];
	};
};

export type MediumArticle = {
	text: string;
	url: string;
	author: string;
	title: string;
	date: string;
	source: string;
	language: string;
}

// TODO: Define LinkedInPost type
// Should have: text (string), date (string), url (string), likes (number)
export type LinkedInPost = {
	text: string;
	date: string;
	url: string;
	likes: number;
};

/**
 * Splits text into smaller chunks for processing
 * @param text The text to chunk
 * @param chunkSize Maximum size of each chunk
 * @param overlap Number of characters to overlap between chunks
 * @param source Source identifier (typically URL)
 * @returns Array of text chunks
 */
export function chunkText(
	text: string,
	chunkSize: number = 500,
	overlap: number = 50,
	source: string = 'unknown'
): Chunk[] {
	const chunks: Chunk[] = [];
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

	let currentChunk = '';
	let chunkStart = 0;
	let chunkIndex = 0;

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i].trim() + '.';

		// If adding this sentence would exceed chunk size, create a chunk
		if (
			currentChunk.length + sentence.length > chunkSize &&
			currentChunk.length > 0
		) {
			const chunk: Chunk = {
				id: `${source}-chunk-${chunkIndex}`,
				content: currentChunk.trim(),
				metadata: {
					source,
					chunkIndex,
					totalChunks: 0, // Will be updated later
					startChar: chunkStart,
					endChar: chunkStart + currentChunk.length,
				},
			};

			chunks.push(chunk);

			// Start new chunk with overlap
			const overlapText = getLastWords(currentChunk, overlap);
			currentChunk = overlapText + ' ' + sentence;
			chunkStart = chunk.metadata.endChar - overlapText.length;
			chunkIndex++;
		} else {
			currentChunk += (currentChunk ? ' ' : '') + sentence;
		}
	}

	// Add final chunk if it has content
	if (currentChunk.trim()) {
		chunks.push({
			id: `${source}-chunk-${chunkIndex}`,
			content: currentChunk.trim(),
			metadata: {
				source,
				chunkIndex,
				totalChunks: 0,
				startChar: chunkStart,
				endChar: chunkStart + currentChunk.length,
			},
		});
	}

	// Update total chunks count
	chunks.forEach((chunk) => {
		chunk.metadata.totalChunks = chunks.length;
	});

	return chunks;
}

/**
 * Gets the last N characters worth of words from a text
 *
 * This is used to create overlap between chunks. We want complete words,
 * not cut-off characters, so we work backwards from the end.
 *
 * @param text The source text
 * @param maxLength Maximum length to return
 * @returns The last words up to maxLength
 *
 * @example
 * getLastWords("React Hooks are awesome", 10)
 * // Returns: "are awesome" (10 chars)
 * // NOT: "re awesome" (cut off "are")
 *

 *
 * Requirements:
 * 1. If text is shorter than maxLength, return the whole text
 * 2. Otherwise, return the last maxLength characters worth of COMPLETE words
 * 3. Build the result backwards to ensure you get the last words
 *
 * Steps:
 * 1. Check if text.length <= maxLength, if so return text
 * 2. Split text into words using .split(' ')
 * 3. Start with empty result string
 * 4. Loop through words BACKWARDS (from end to start)
 * 5. For each word, check if adding it would exceed maxLength
 * 6. If it would exceed, break the loop
 * 7. Otherwise, prepend the word to result (word + ' ' + result)
 * 8. Return the result
 */
function getLastWords(text: string, maxLength: number): string {
	// TODO: Implement this function!
	// YOUR CODE HERE
		//If text is already short, return it
		if (text.length <= maxLength) {
			return text;
		}
		//Split text into words
		const words = text.split(' ');
	
		let result = '';
	
		//Loop backwards through the words
		for (let i = words.length - 1; i >= 0; i--) {
			const word = words[i];
			//new result
			const candidate = result === '' ? word : `${word} ${result}`;
	
			//Check if adding this word would exceed maxLength
			if (candidate.length > maxLength) {
				break;
			}
			result = candidate;
		}
		return result;
}


/**
 * Extracts article data from a Medium HTML export
 * @param html The HTML content of a Medium article export
 * @returns A MediumArticle object with extracted data
 */
export function extraMediumArticle(html: string): MediumArticle {
	const $ = cheerio.load(html);

	// Extract title from h1.p-name
	const title = $('h1.p-name').text().trim() || '';

	// Extract author from footer a.p-author
	const author = $('footer a.p-author.h-card').text().trim() || '';

	// Extract date from footer time.dt-published
	const dateTime = $('footer time.dt-published').attr('datetime') || '';
	const dateText = $('footer time.dt-published').text().trim() || dateTime;
	const date = dateText;

	// Extract URL from footer a.p-canonical
	const url = $('footer a.p-canonical').attr('href') || '';

	// Extract text content from section[data-field="body"]
	const bodySection = $('section[data-field="body"].e-content');
	const paragraphs: string[] = [];
	
	bodySection.find('p').each((_index: number, elem) => {
		const text = $(elem).text().trim();
		if (text) {
			paragraphs.push(text);
		}
	});

	const text = paragraphs.join(' ').trim();

	// Extract language from html lang attribute or default to 'en'
	const language = $('html').attr('lang') || 'en';

	return {
		text,
		url,
		author,
		title,
		date,
		source: 'medium',
		language,
	};
}

/**
 * TODO: Implement extractLinkedInPosts function
 *
 * This function should extract LinkedIn posts from CSV data.
 *
 * @param csvContent The CSV file content as a string
 * @returns Array of LinkedInPost objects with text, date, url, and likes
 *
 * Requirements:
 * 1. Parse the CSV header to find column indices for:
 *    - text: the post content
 *    - createdAt (TZ=America/Los_Angeles): the date
 *    - link: the URL
 *    - numReactions: the number of likes
 *
 * 2. Handle CSV parsing properly:
 *    - Fields can be quoted with double quotes
 *    - Quoted fields can contain commas
 *    - Use a simple parser or handle quoted fields manually
 *
 * 3. Skip the header row and process each data row
 *
 * 4. Return an array of LinkedInPost objects
 *
 * Hints:
 * - Split by newlines to get rows
 * - For each row, carefully parse considering quoted fields
 * - Extract the values at the correct column indices
 * - Convert numReactions to a number using parseInt()
 */
/**
 * Extract LinkedIn posts from CSV data.
 */
export function extractLinkedInPosts(csvContent: string): LinkedInPost[] {
	const rows = splitCsvRows(csvContent);
	if (rows.length === 0) return [];

	// Header
	const header = parseCsvRow(rows[0]);
	const idxText = findHeaderIndex(header, ['text', 'post text', 'content']);
	const idxDate = findHeaderIndex(header, ['createdat (tz=america/los_angeles)', 'createdat', 'created at']);
	const idxLink = findHeaderIndex(header, ['link', 'url']);
	const idxLikes = findHeaderIndex(header, ['numreactions', 'reactions', 'likes']);

	// If required columns aren't found, return empty (or throw, if you prefer strict behavior).
	if (idxText === -1 || idxDate === -1 || idxLink === -1 || idxLikes === -1) return [];

	const posts: LinkedInPost[] = [];

	for (let i = 1; i < rows.length; i++) {
		const rowStr = rows[i];
		if (!rowStr || !rowStr.trim()) continue;

		const cols = parseCsvRow(rowStr);

		// Text field may be quoted and contain commas, so don't trim it
		// (parseCsvRow already preserves quoted fields and trims non-quoted ones)
		const text = (cols[idxText] ?? '').trim();
		const date = (cols[idxDate] ?? '').trim();
		const url = (cols[idxLink] ?? '').trim();
		const likesRaw = (cols[idxLikes] ?? '').trim();

		// Skip rows that don't look like posts
		if (!text && !url) continue;

		const likes = Number.isFinite(Number(likesRaw)) ? parseInt(likesRaw, 10) : 0;

		posts.push({
			text,
			date,
			url,
			likes: Number.isNaN(likes) ? 0 : likes,
		});
	}

	return posts;
}

/**
 * Splits CSV content into row strings, respecting quoted fields that may contain newlines.
 */
function splitCsvRows(csv: string): string[] {
	const rows: string[] = [];
	let cur = '';
	let inQuotes = false;

	// Normalize line endings
	const s = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

	for (let i = 0; i < s.length; i++) {
		const ch = s[i];

		if (ch === '"') {
			// If we're in quotes and the next char is a quote, it's an escaped quote ("")
			// Preserve both quotes so parseCsvRow can handle the escaping
			if (inQuotes && s[i + 1] === '"') {
				cur += '""';
				i++; // Skip the next quote since we've added both
			} else {
				// Preserve the quote character in the output
				cur += '"';
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (ch === '\n' && !inQuotes) {
			rows.push(cur);
			cur = '';
			continue;
		}

		cur += ch;
	}

	// Add last row if non-empty or if file ends without newline
	if (cur.length > 0) rows.push(cur);

	// Trim off trailing empty lines
	while (rows.length > 0 && rows[rows.length - 1].trim() === '') rows.pop();

	return rows;
}

/**
 * Parses one CSV row into fields, respecting quoted fields and commas.
 * Assumes the row string does not include the terminating newline.
 */
function parseCsvRow(row: string): string[] {
	const out: string[] = [];
	let cur = '';
	let inQuotes = false;
	const fieldQuoted: boolean[] = [];
	let fieldIndex = 0;

	for (let i = 0; i < row.length; i++) {
		const ch = row[i];

		if (ch === '"') {
			// Escaped quote inside a quoted field
			if (inQuotes && row[i + 1] === '"') {
				cur += '"';
				i++; // Skip the next quote
			} else {
				if (!inQuotes) {
					// Starting a quoted field
					fieldQuoted[fieldIndex] = true;
				}
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (ch === ',' && !inQuotes) {
			// Field complete - only trim if field was not quoted
			const value = fieldQuoted[fieldIndex] ? cur : cur.trim();
			out.push(value);
			cur = '';
			fieldIndex++;
			continue;
		}

		cur += ch;
	}

	// Push last field
	const value = fieldQuoted[fieldIndex] ? cur : cur.trim();
	out.push(value);

	return out;
}

function findHeaderIndex(header: string[], candidates: string[]): number {
	const normalizedHeader = header.map((h) => normalizeHeader(h));
	const normalizedCandidates = candidates.map((c) => normalizeHeader(c));

	for (const cand of normalizedCandidates) {
		const idx = normalizedHeader.indexOf(cand);
		if (idx !== -1) return idx;
	}

	// Also allow "contains" matching (useful for long column names)
	for (let i = 0; i < normalizedHeader.length; i++) {
		for (const cand of normalizedCandidates) {
			if (normalizedHeader[i].includes(cand)) return i;
		}
	}

	return -1;
}

function normalizeHeader(s: string): string {
	return s
		.toLowerCase()
		.replace(/\uFEFF/g, '') // BOM
		.replace(/\s+/g, ' ')
		.trim();
}
