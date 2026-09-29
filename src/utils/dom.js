export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children); return node;
}
export function button(text, onClick, options = {}) { return el('button', {type: 'button', text, onclick: onClick, ...options}); }
export function field(label, input) { if (!input.hasAttribute('aria-label')) input.setAttribute('aria-label', label); return el('label', {}, [el('span', {text: label}), input]); }
export const styles = `
  :host{display:block;color:var(--primary-text-color,#222);font-family:inherit}
  *{box-sizing:border-box}ha-card{display:block;padding:16px}h2{font-size:20px;margin:0}h3{font-size:16px}
  button,input,select{font:inherit;color:inherit;border:1px solid var(--divider-color,#ccc);border-radius:8px;background:var(--card-background-color,#fff);padding:8px}
  button{cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--primary-color,#03a9f4)}
  .toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.toolbar h2{flex:1}
  label{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:8px 0}input[type=number]{width:90px}.range-control{display:flex;align-items:center;gap:8px;width:min(260px,60%)}.range-control input{flex:1;min-width:70px;padding:0;border:0;background:transparent}.range-control output{min-width:3ch;text-align:right;font-variant-numeric:tabular-nums}
  .notice{white-space:pre-wrap;font-size:13px;color:var(--secondary-text-color,#666);margin:8px 0}.error{color:var(--error-color,#db4437)}
  .grid{display:grid;grid-template-columns:repeat(var(--columns,3),minmax(0,1fr));gap:10px}
  .tile{position:relative;min-width:0;border-radius:12px;overflow:hidden;border:2px solid transparent;background:var(--secondary-background-color,#eee)}
  .tile.active{border-color:var(--primary-color,#03a9f4)}.tile .apply{padding:0;width:100%;height:100%;border:0;background:transparent;text-align:left;display:block;min-height:100px}
  .tile img{display:block;width:100%;aspect-ratio:1.45;object-fit:cover}.tile .name,.tile .category{display:block;padding:6px 10px;overflow-wrap:anywhere}.tile .category{font-size:12px;color:var(--secondary-text-color,#666)}
  .tile .name{text-align:var(--preset-name-align,left)}
  .preset-group + .preset-group{margin-top:22px}.category-heading{margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid var(--divider-color,#ddd);font-weight:600;overflow-wrap:anywhere}
  .tile .favorite{position:absolute;right:4px;top:4px;z-index:2;padding:4px 7px}.tile .badge{position:absolute;left:4px;top:4px;background:var(--card-background-color,#fff);border-radius:4px;padding:2px 5px;pointer-events:none}
  .child{pointer-events:none}.child-action{position:absolute;inset:0;opacity:0}.placeholder{display:grid;place-items:center;aspect-ratio:1.45;font-size:32px;background:linear-gradient(130deg,#617b8c,#9b7c92)}
  .controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 16px;margin:12px 0}
  details{margin:12px 0}summary{cursor:pointer;font-weight:500}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
`;
