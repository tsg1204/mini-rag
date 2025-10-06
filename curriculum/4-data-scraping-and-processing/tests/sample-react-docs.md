# React Quick Start Guide

React Quick Start Guide Overview

The guide introduces core React concepts, focusing on how developers can create interactive web applications using React's component-based architecture. Key learning objectives include:

## Creating and Nesting Components

React apps are built from "components" - UI pieces with unique logic and appearance. Components are JavaScript functions returning markup. Component names must start with capital letters. Components can be nested within other components.

Here's an example of a simple component:

```jsx
function MyButton() {
  return (
    <button>I'm a button</button>
  );
}

export default function MyApp() {
  return (
    <div>
      <h1>Welcome to my app</h1>
      <MyButton />
    </div>
  );
}
```

Notice that `<MyButton />` starts with a capital letter. That's how you know it's a React component. React component names must always start with a capital letter, while HTML tags must be lowercase.

## Writing Markup with JSX

JSX is a syntax extension for JavaScript that allows you to write markup inside a JavaScript file. JSX is more strict than HTML and requires closed tags. You can't return multiple JSX tags from a component. You have to wrap them into a shared parent, like a `<div>...</div>` or an empty `<>...</>` wrapper.

```jsx
function AboutPage() {
  return (
    <>
      <h1>About</h1>
      <p>Hello there.<br />How do you do?</p>
    </>
  );
}
```

If you have a lot of HTML to port to JSX, you can use an online converter or configure your editor to help with the conversion process.

## Adding Styles

In React, you specify a CSS class with `className`. It works the same way as the HTML `class` attribute:

```jsx
<img className="avatar" />
```

Then you write the CSS rules for it in a separate CSS file:

```css
.avatar {
  border-radius: 50%;
}
```

React doesn't prescribe how you add CSS files. In the simplest case, you'll add a `<link>` tag to your HTML. If you use a build tool or a framework, consult its documentation to learn how to add a CSS file to your project.

## Displaying Data

JSX lets you put markup into JavaScript. Curly braces let you "escape back" into JavaScript so that you can embed some variable from your code and display it to the user. For example, this will display `user.name`:

```jsx
return (
  <h1>
    {user.name}
  </h1>
);
```

You can also "escape into JavaScript" from JSX attributes, but you have to use curly braces instead of quotes. For example, `className="avatar"` passes the "avatar" string as the CSS class, but `src={user.imageUrl}` reads the JavaScript `user.imageUrl` variable value and then passes that value as the `src` attribute:

```jsx
return (
  <img
    className="avatar"
    src={user.imageUrl}
  />
);
```

You can put more complex expressions inside the JSX curly braces too, for example, string concatenation:

```jsx
const user = {
  name: 'Hedy Lamarr',
  imageUrl: 'https://i.imgur.com/yXOvdOSs.jpg',
  imageSize: 90,
};

export default function Profile() {
  return (
    <>
      <h1>{user.name}</h1>
      <img
        className="avatar"
        src={user.imageUrl}
        alt={'Photo of ' + user.name}
        style={{
          width: user.imageSize,
          height: user.imageSize
        }}
      />
    </>
  );
}
```

In the above example, `style={{}}` is not a special syntax, but a regular `{}` object inside the `style={ }` JSX curly braces. You can use the `style` attribute when your styles depend on JavaScript variables.

## Conditional Rendering

In React, there is no special syntax for writing conditions. Instead, you'll use the same techniques as you use when writing regular JavaScript code. For example, you can use an `if` statement to conditionally include JSX:

```jsx
let content;
if (isLoggedIn) {
  content = <AdminPanel />;
} else {
  content = <LoginForm />;
}
return (
  <div>
    {content}
  </div>
);
```

If you prefer more compact code, you can use the conditional `?` operator. Unlike `if`, it works inside JSX:

```jsx
<div>
  {isLoggedIn ? (
    <AdminPanel />
  ) : (
    <LoginForm />
  )}
</div>
```

When you don't need the `else` branch, you can also use a shorter logical `&&` syntax:

```jsx
<div>
  {isLoggedIn && <AdminPanel />}
</div>
```

All of these approaches also work for conditionally specifying attributes. If you're unfamiliar with some of this JavaScript syntax, you can start by always using `if...else`.

## Rendering Lists

You will rely on JavaScript features like `for` loop and the array `map()` function to render lists of components.

For example, let's say you have an array of products:

```jsx
const products = [
  { title: 'Cabbage', id: 1 },
  { title: 'Garlic', id: 2 },
  { title: 'Apple', id: 3 },
];
```

Inside your component, use the `map()` function to transform an array of products into an array of `<li>` items:

```jsx
const listItems = products.map(product =>
  <li key={product.id}>
    {product.title}
  </li>
);

return <ul>{listItems}</ul>;
```

Notice that `<li>` has a `key` attribute. For each item in a list, you should pass a string or a number that uniquely identifies that item among its siblings. Usually, a key should be coming from your data, such as a database ID. React uses your keys to know what happened if you later insert, delete, or reorder the items.

```jsx
const products = [
  { title: 'Cabbage', isFruit: false, id: 1 },
  { title: 'Garlic', isFruit: false, id: 2 },
  { title: 'Apple', isFruit: true, id: 3 },
];

export default function ShoppingList() {
  const listItems = products.map(product =>
    <li
      key={product.id}
      style={{
        color: product.isFruit ? 'magenta' : 'darkgreen'
      }}
    >
      {product.title}
    </li>
  );

  return <ul>{listItems}</ul>;
}
```

## Responding to Events

You can respond to events by declaring event handler functions inside your components:

```jsx
function MyButton() {
  function handleClick() {
    alert('You clicked me!');
  }

  return (
    <button onClick={handleClick}>
      Click me
    </button>
  );
}
```

Notice that `onClick={handleClick}` has no parentheses at the end! Do not call the event handler function: you only need to pass it down. React will call your event handler when the user clicks the button.

## Updating the Screen

Often, you'll want your component to "remember" some information and display it. For example, maybe you want to count the number of times a button is clicked. To do this, add state to your component.

First, import `useState` from React:

```jsx
import { useState } from 'react';
```

Now you can declare a state variable inside your component:

```jsx
function MyButton() {
  const [count, setCount] = useState(0);
  // ...
}
```

You'll get two things from `useState`: the current state (`count`), and the function that lets you update it (`setCount`). You can give them any names, but the convention is to write `[something, setSomething]`.

The first time the button is displayed, `count` will be `0` because you passed `0` to `useState()`. When you want to change state, call `setCount()` and pass the new value to it. Clicking this button will increment the counter:

```jsx
function MyButton() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
  }

  return (
    <button onClick={handleClick}>
      Clicked {count} times
    </button>
  );
}
```

React will call your component function again. This time, `count` will be `1`. Then it will be `2`. And so on.

If you render the same component multiple times, each will get its own state. Click each button separately:

```jsx
import { useState } from 'react';

export default function MyApp() {
  return (
    <div>
      <h1>Counters that update separately</h1>
      <MyButton />
      <MyButton />
    </div>
  );
}

function MyButton() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
  }

  return (
    <button onClick={handleClick}>
      Clicked {count} times
    </button>
  );
}
```

Notice how each button "remembers" its own `count` state and doesn't affect other buttons.

## Using Hooks

Functions starting with `use` are called Hooks. `useState` is a built-in Hook provided by React. You can find other built-in Hooks in the API reference. You can also write your own Hooks by combining the existing ones.

Hooks are more restrictive than other functions. You can only call Hooks at the top of your components (or other Hooks). If you want to use `useState` in a condition or a loop, extract a new component and put it there.

## Sharing Data Between Components

In the previous example, each `MyButton` had its own independent `count`, and when each button was clicked, only the `count` for the button clicked changed:

Initially, each `MyButton`'s `count` state is `0`. The first `MyButton` updates its `count` to `1`. But you'll often need components to share data and always update together.

To make both `MyButton` components display the same `count` and update together, you need to move the state from the individual buttons "upward" to the closest component containing all of them.

In this example, it is `MyApp`:

Now when you click either button, the `count` in `MyApp` will change, which will change both of the counts in `MyButton`. Here's how you can express this in code.

First, move the state up from `MyButton` to `MyApp`:

```jsx
export default function MyApp() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
  }

  return (
    <div>
      <h1>Counters that update together</h1>
      <MyButton count={count} onClick={handleClick} />
      <MyButton count={count} onClick={handleClick} />
    </div>
  );
}
```

Then, pass the state down from `MyApp` to each `MyButton`, together with the shared click handler. You can pass information to `MyButton` using the JSX curly braces, just like you previously did with built-in tags like `<img>`:

```jsx
export default function MyApp() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
  }

  return (
    <div>
      <h1>Counters that update together</h1>
      <MyButton count={count} onClick={handleClick} />
      <MyButton count={count} onClick={handleClick} />
    </div>
  );
}

function MyButton({ count, onClick }) {
  return (
    <button onClick={onClick}>
      Clicked {count} times
    </button>
  );
}
```

The information you pass down like this is called props. Now the `MyApp` component contains the `count` state and the `handleClick` event handler, and passes both of them down as props to each of the buttons.

Finally, change `MyButton` to read the props you have passed from its parent component:

```jsx
function MyButton({ count, onClick }) {
  return (
    <button onClick={onClick}>
      Clicked {count} times
    </button>
  );
}
```

When you click the button, the `onClick` handler fires. Each button's `onClick` prop was set to the `handleClick` function inside `MyApp`, so the code inside of it runs. That code calls `setCount(count + 1)`, incrementing the `count` state variable. The new `count` value is passed as a prop to each button, so they all show the new value. This is called "lifting state up". By moving state up, you've shared it between components.

## Advanced React Concepts

React offers many advanced features for building complex applications:

### Context API

The React Context API allows you to share values between components without having to explicitly pass a prop through every level of the component tree. Context is designed to share data that can be considered "global" for a tree of React components, such as the current authenticated user, theme, or preferred language.

### Error Boundaries

Error boundaries are React components that catch JavaScript errors anywhere in their child component tree, log those errors, and display a fallback UI instead of the component tree that crashed. Error boundaries catch errors during rendering, in lifecycle methods, and in constructors of the whole tree below them.

### Fragments

React Fragments let you group a list of children without adding extra nodes to the DOM. This is useful when you need to return multiple elements from a component but don't want to wrap them in an additional HTML element.

### Higher-Order Components

A higher-order component (HOC) is an advanced technique in React for reusing component logic. HOCs are not part of the React API, per se. They are a pattern that emerges from React's compositional nature.

### Render Props

The term "render prop" refers to a technique for sharing code between React components using a prop whose value is a function. A component with a render prop takes a function that returns a React element and calls it instead of implementing its own render logic.

## Performance Optimization

React provides several ways to optimize your application's performance:

### React.memo

React.memo is a higher order component that will memoize your component. If your component renders the same result given the same props, you can wrap it in a call to React.memo for a performance boost in some cases by memoizing the result.

### useMemo and useCallback

The useMemo hook returns a memoized value, while useCallback returns a memoized callback function. Both hooks help prevent unnecessary recalculations and re-renders by memoizing expensive calculations or function references.

### Code Splitting

Code splitting is a feature supported by bundlers like Webpack and Browserify which can create multiple bundles that can be dynamically loaded at runtime. Code splitting your app can help you "lazy-load" just the things that are currently needed by the user, which can dramatically improve the performance of your app.

## Testing React Applications

Testing is an important part of developing React applications. There are several approaches and tools available:

### Jest and React Testing Library

Jest is a JavaScript testing framework that works well with React. React Testing Library is a simple and complete testing utility that encourages good testing practices by testing components in a way that resembles how users interact with them.

### Enzyme

Enzyme is a JavaScript testing utility for React that makes it easier to test your React Components' output. You can also manipulate, traverse, and in some ways simulate runtime given the output.

### Snapshot Testing

Snapshot testing is a feature of Jest that can capture snapshots of React trees or other serializable values to ensure that a UI does not change unexpectedly.

## React Ecosystem

The React ecosystem includes many complementary libraries and tools:

### State Management

- Redux: A predictable state container for JavaScript apps
- MobX: Simple, scalable state management through reactive programming
- Zustand: A small, fast and scalable bearbones state-management solution

### Routing

- React Router: Declarative routing for React applications
- Next.js Router: Built-in routing solution for Next.js applications
- Reach Router: Now merged with React Router

### Styling

- Styled Components: CSS-in-JS library for styling React components
- Emotion: A CSS-in-JS library designed for high performance style composition
- CSS Modules: A CSS file in which all class names and animation names are scoped locally by default

### Development Tools

- React Developer Tools: Browser extension for debugging React applications
- Storybook: Tool for building UI components and pages in isolation
- Create React App: Set up a modern web app by running one command

The React ecosystem continues to evolve, with new tools and libraries being developed to solve common problems and improve the developer experience.