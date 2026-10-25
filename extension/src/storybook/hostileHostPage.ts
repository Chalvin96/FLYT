const HOSTILE_HOST_CSS = `
  body {
    font: 20px "Comic Sans MS", cursive;
    color: rgb(255, 0, 0);
    line-height: 3;
    letter-spacing: 4px;
    text-transform: uppercase;
  }

  * {
    box-sizing: content-box;
    border-color: rgb(255, 0, 0);
  }

  button {
    text-transform: uppercase;
    font-size: 30px;
  }
`;

export function installHostileHostPage(): () => void {
  const style = document.createElement("style");
  style.textContent = HOSTILE_HOST_CSS;
  document.head.append(style);
  return () => style.remove();
}
