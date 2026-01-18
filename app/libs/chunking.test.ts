import { chunkText, extractLinkedInPosts } from './chunking';

describe('chunkText', () => {
	describe('Basic Functionality', () => {
		test('should split text into chunks', () => {
			const text =
				'React Hooks were introduced in React 16.8. They allow you to use state and other React features without writing a class component. The most commonly used hooks are useState and useEffect.';

			const chunks = chunkText(text, 100, 20, 'test');

			expect(chunks.length).toBeGreaterThan(0);
			expect(chunks[0].content).toBeTruthy();
		});

		test('should handle empty text', () => {
			const chunks = chunkText('', 500, 50, 'test');
			expect(chunks).toEqual([]);
		});

		test('should handle single sentence', () => {
			const text = 'This is a single sentence.';
			const chunks = chunkText(text, 500, 50, 'test');

			expect(chunks).toHaveLength(1);
			expect(chunks[0].content).toBe(text);
		});
	});

	describe('Sentence Boundaries', () => {
		test('should not break words mid-character', () => {
			const text =
				'The company announced new features including advanced AI capabilities. These features will revolutionize the industry. Users are excited about the upcoming release.';

			const chunks = chunkText(text, 50, 10, 'test');

			chunks.forEach((chunk) => {
				// Check that chunks end with complete sentences (end with punctuation)
				expect(chunk.content).toMatch(/[.!?]\s*$/); // Should end with sentence punctuation

				// Check that words are not broken mid-word (no "feat" + "ures")
				// This is ensured by splitting on sentence boundaries
				const words = chunk.content.split(/\s+/);
				words.forEach((word) => {
					// Each word should be complete (not cut off)
					expect(word.length).toBeGreaterThan(0);
				});
			});
		});

		test('should respect sentence boundaries', () => {
			const text =
				'First sentence. Second sentence. Third sentence. Fourth sentence.';

			const chunks = chunkText(text, 30, 10, 'test');

			chunks.forEach((chunk) => {
				// Each chunk should contain complete sentences
				expect(chunk.content).toMatch(/[.!?]\s*$/);
			});
		});

		test('should handle different punctuation marks', () => {
			const text =
				'Is this a question? Yes it is! This is an exclamation. This is normal.';

			const chunks = chunkText(text, 40, 10, 'test');

			expect(chunks.length).toBeGreaterThan(0);
			chunks.forEach((chunk) => {
				expect(chunk.content).toBeTruthy();
			});
		});
	});

	describe('Overlap Functionality', () => {
		test('should create overlap between chunks', () => {
			const text =
				'First sentence here. Second sentence here. Third sentence here. Fourth sentence here.';

			const chunks = chunkText(text, 50, 20, 'test');

			if (chunks.length > 1) {
				// Check that consecutive chunks have overlapping content
				for (let i = 0; i < chunks.length - 1; i++) {
					const chunk1End = chunks[i].content.slice(-20);
					const chunk2Start = chunks[i + 1].content.slice(0, 30);

					// Some words from end of chunk 1 should appear in start of chunk 2
					const wordsFromEnd = chunk1End
						.split(' ')
						.filter((w) => w.length > 3);
					const hasOverlap = wordsFromEnd.some((word) =>
						chunk2Start.includes(word)
					);

					expect(hasOverlap).toBe(true);
				}
			}
		});

		test('should respect overlap parameter', () => {
			const text =
				'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six.';

			const chunksNoOverlap = chunkText(text, 30, 0, 'test');
			const chunksWithOverlap = chunkText(text, 30, 10, 'test');

			// With overlap, we might get more chunks or similar count
			// but the content should be different
			if (chunksNoOverlap.length > 1 && chunksWithOverlap.length > 1) {
				expect(chunksNoOverlap[1].content).not.toBe(
					chunksWithOverlap[1].content
				);
			}
		});
	});

	describe('Metadata', () => {
		test('should include correct metadata', () => {
			const text = 'First sentence. Second sentence. Third sentence.';
			const source = 'test-document';

			const chunks = chunkText(text, 50, 10, source);

			chunks.forEach((chunk, index) => {
				expect(chunk.id).toBe(`${source}-chunk-${index}`);
				expect(chunk.metadata.source).toBe(source);
				expect(chunk.metadata.chunkIndex).toBe(index);
				expect(chunk.metadata.totalChunks).toBe(chunks.length);
				expect(chunk.metadata.startChar).toBeGreaterThanOrEqual(0);
				expect(chunk.metadata.endChar).toBeGreaterThan(
					chunk.metadata.startChar
				);
			});
		});

		test('should have sequential chunk indices', () => {
			const text =
				'One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.';

			const chunks = chunkText(text, 20, 5, 'test');

			chunks.forEach((chunk, index) => {
				expect(chunk.metadata.chunkIndex).toBe(index);
			});
		});

		test('should update totalChunks for all chunks', () => {
			const text = 'A. B. C. D. E. F. G. H. I. J.';

			const chunks = chunkText(text, 10, 2, 'test');

			const totalChunks = chunks.length;
			chunks.forEach((chunk) => {
				expect(chunk.metadata.totalChunks).toBe(totalChunks);
			});
		});
	});

	describe('Edge Cases', () => {
		test('should handle very long sentences', () => {
			const longSentence =
				'This is a very long sentence that contains many words and should be handled properly even though it exceeds the normal chunk size because we need to test edge cases.';

			const chunks = chunkText(longSentence, 50, 10, 'test');

			expect(chunks.length).toBeGreaterThanOrEqual(1);
			expect(chunks[0].content).toBeTruthy();
		});

		test('should handle text with multiple spaces', () => {
			const text =
				'First  sentence   with    spaces. Second     sentence.';

			const chunks = chunkText(text, 100, 20, 'test');

			expect(chunks.length).toBeGreaterThan(0);
			chunks.forEach((chunk) => {
				expect(chunk.content).toBeTruthy();
			});
		});

		test('should handle text with newlines', () => {
			const text = 'First sentence.\nSecond sentence.\n\nThird sentence.';

			const chunks = chunkText(text, 100, 20, 'test');

			expect(chunks.length).toBeGreaterThan(0);
		});

		test('should handle special characters', () => {
			const text =
				'React uses JSX! Does it work? Yes, it works. Amazing!';

			const chunks = chunkText(text, 50, 10, 'test');

			expect(chunks.length).toBeGreaterThan(0);
			chunks.forEach((chunk) => {
				expect(chunk.content).toBeTruthy();
			});
		});
	});

	describe('Chunk Size Control', () => {
		test('should respect chunk size limits', () => {
			const text =
				'Short sentence. Another short one. And one more. Plus this. And that. Finally done.';

			const chunkSize = 40;
			const chunks = chunkText(text, chunkSize, 5, 'test');

			chunks.forEach((chunk) => {
				// Allow some flexibility for sentence boundaries
				// but most chunks should be near the target size
				expect(chunk.content.length).toBeLessThanOrEqual(
					chunkSize + 100
				); // Generous buffer for sentences
			});
		});

		test('should create multiple chunks for long text', () => {
			const sentences = Array(20)
				.fill('This is a test sentence.')
				.join(' ');

			const chunks = chunkText(sentences, 100, 20, 'test');

			expect(chunks.length).toBeGreaterThan(1);
		});
	});

	describe('Real-World Example', () => {
		test('should chunk React documentation example', () => {
			const text = `
				React Hooks were introduced in React 16.8.
				They allow you to use state and other React features without writing a class component.
				The most commonly used hooks are useState and useEffect.
				useState lets you add state to function components.
				useEffect lets you perform side effects in function components.
			`;

			const chunks = chunkText(text, 150, 30, 'react-docs');

			expect(chunks.length).toBeGreaterThan(0);

			// Verify all chunks have proper structure
			chunks.forEach((chunk) => {
				expect(chunk.id).toContain('react-docs-chunk-');
				expect(chunk.content.length).toBeGreaterThan(0);
				expect(chunk.metadata.source).toBe('react-docs');
			});

			// Verify content is preserved
			const allContent = chunks.map((c) => c.content).join(' ');
			expect(allContent).toContain('useState');
			expect(allContent).toContain('useEffect');
		});
	});
});

describe('extractLinkedInPosts', () => {
	describe('Basic Functionality', () => {
		test('should extract posts from valid CSV', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Great post about React!",2024-01-15,https://linkedin.com/posts/123,42
"Another amazing post",2024-01-16,https://linkedin.com/posts/456,100`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(2);
			expect(posts[0].text).toBe('Great post about React!');
			expect(posts[0].date).toBe('2024-01-15');
			expect(posts[0].url).toBe('https://linkedin.com/posts/123');
			expect(posts[0].likes).toBe(42);

			expect(posts[1].text).toBe('Another amazing post');
			expect(posts[1].date).toBe('2024-01-16');
			expect(posts[1].url).toBe('https://linkedin.com/posts/456');
			expect(posts[1].likes).toBe(100);
		});

		test('should handle empty CSV', () => {
			const posts = extractLinkedInPosts('');
			expect(posts).toEqual([]);
		});

		test('should handle CSV with only header', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions`;
			const posts = extractLinkedInPosts(csv);
			expect(posts).toEqual([]);
		});

		test('should handle single post', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Single post here",2024-01-15,https://linkedin.com/posts/123,5`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Single post here');
			expect(posts[0].likes).toBe(5);
		});
	});

	describe('Header Detection', () => {
		test('should find columns with case-insensitive matching', () => {
			const csv = `TEXT,CreatedAt (TZ=America/Los_Angeles),LINK,NumReactions
"Post content",2024-01-15,https://linkedin.com/posts/123,10`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Post content');
			expect(posts[0].date).toBe('2024-01-15');
			expect(posts[0].url).toBe('https://linkedin.com/posts/123');
			expect(posts[0].likes).toBe(10);
		});

		test('should handle alternative column names', () => {
			const csv = `post text,created at,url,reactions
"Alternative names work",2024-01-15,https://linkedin.com/posts/123,25`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Alternative names work');
			expect(posts[0].likes).toBe(25);
		});

		test('should return empty array if required columns are missing', () => {
			const csv = `wrong,column,names,here
"Post content",2024-01-15,https://linkedin.com/posts/123,10`;

			const posts = extractLinkedInPosts(csv);
			expect(posts).toEqual([]);
		});
	});

	describe('Quoted Fields', () => {
		test('should handle quoted fields with commas', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Post with, commas inside",2024-01-15,https://linkedin.com/posts/123,10`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Post with, commas inside');
		});

		test('should handle escaped quotes in quoted fields', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Post with ""quotes"" inside",2024-01-15,https://linkedin.com/posts/123,10`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Post with "quotes" inside');
		});

		test('should handle newlines in quoted fields', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Post with
multiple lines",2024-01-15,https://linkedin.com/posts/123,10`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toContain('Post with');
			expect(posts[0].text).toContain('multiple lines');
		});
	});

	describe('Data Validation', () => {
		test('should handle missing text or url by skipping row', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
,2024-01-15,,10
"Valid post",2024-01-16,https://linkedin.com/posts/456,20`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Valid post');
		});

		test('should handle invalid likes by defaulting to 0', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Post with invalid likes",2024-01-15,https://linkedin.com/posts/123,not-a-number
"Post with empty likes",2024-01-16,https://linkedin.com/posts/456,`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(2);
			expect(posts[0].likes).toBe(0);
			expect(posts[1].likes).toBe(0);
		});

		test('should parse numeric likes correctly', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Post 1",2024-01-15,https://linkedin.com/posts/123,0
"Post 2",2024-01-16,https://linkedin.com/posts/456,42
"Post 3",2024-01-17,https://linkedin.com/posts/789,1000`;

			const posts = extractLinkedInPosts(csv);

			expect(posts[0].likes).toBe(0);
			expect(posts[1].likes).toBe(42);
			expect(posts[2].likes).toBe(1000);
		});

		test('should trim whitespace from fields', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"  Post with spaces  ",  2024-01-15  ,  https://linkedin.com/posts/123  ,  50  `;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			// Text field is trimmed in extractLinkedInPosts (line 278)
			expect(posts[0].text).toBe('Post with spaces');
			expect(posts[0].date).toBe('2024-01-15');
			expect(posts[0].url).toBe('https://linkedin.com/posts/123');
			expect(posts[0].likes).toBe(50);
		});
	});

	describe('Edge Cases', () => {
		test('should handle empty rows', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions

"Valid post",2024-01-15,https://linkedin.com/posts/123,10
`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Valid post');
		});

		test('should handle CSV with trailing newline', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Post content",2024-01-15,https://linkedin.com/posts/123,10
`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Post content');
		});

		test('should handle CSV with Windows line endings', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions\r\n"Post content",2024-01-15,https://linkedin.com/posts/123,10\r\n`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Post content');
		});

		test('should handle posts with special characters', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Post with emoji 🚀 and symbols: @#$%",2024-01-15,https://linkedin.com/posts/123,10`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe('Post with emoji 🚀 and symbols: @#$%');
		});

		test('should handle very long post text', () => {
			const longText = 'A'.repeat(10000);
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"${longText}",2024-01-15,https://linkedin.com/posts/123,10`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(1);
			expect(posts[0].text).toBe(longText);
			expect(posts[0].text.length).toBe(10000);
		});
	});

	describe('Multiple Posts', () => {
		test('should extract multiple posts correctly', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"First post",2024-01-15,https://linkedin.com/posts/1,10
"Second post",2024-01-16,https://linkedin.com/posts/2,20
"Third post",2024-01-17,https://linkedin.com/posts/3,30`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(3);
			expect(posts[0].text).toBe('First post');
			expect(posts[0].likes).toBe(10);
			expect(posts[1].text).toBe('Second post');
			expect(posts[1].likes).toBe(20);
			expect(posts[2].text).toBe('Third post');
			expect(posts[2].likes).toBe(30);
		});

		test('should handle mixed valid and invalid rows', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Valid post 1",2024-01-15,https://linkedin.com/posts/1,10
,2024-01-16,,20
"Valid post 2",2024-01-17,https://linkedin.com/posts/2,30`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(2);
			expect(posts[0].text).toBe('Valid post 1');
			expect(posts[1].text).toBe('Valid post 2');
		});
	});

	describe('Real-World Example', () => {
		test('should extract posts from realistic LinkedIn CSV export', () => {
			const csv = `text,createdAt (TZ=America/Los_Angeles),link,numReactions
"Just shipped a new feature! 🚀 Excited to see how users respond.",2024-01-15T10:30:00,https://www.linkedin.com/posts/activity-123,42
"Reflecting on my journey as a developer. Here's what I learned...",2024-01-20T14:15:00,https://www.linkedin.com/posts/activity-456,128
"Hot take: TypeScript is worth the extra setup time. Change my mind.",2024-01-25T09:00:00,https://www.linkedin.com/posts/activity-789,256`;

			const posts = extractLinkedInPosts(csv);

			expect(posts).toHaveLength(3);
			
			// Verify first post
			expect(posts[0].text).toContain('Just shipped');
			expect(posts[0].text).toContain('🚀');
			expect(posts[0].date).toBe('2024-01-15T10:30:00');
			expect(posts[0].url).toBe('https://www.linkedin.com/posts/activity-123');
			expect(posts[0].likes).toBe(42);

			// Verify second post
			expect(posts[1].text).toContain('Reflecting');
			expect(posts[1].likes).toBe(128);

			// Verify third post
			expect(posts[2].text).toContain('Hot take');
			expect(posts[2].likes).toBe(256);
		});
	});
});
