export function App() {
  return (
    <main className="app-shell">
      <h1>宝可梦“我是谁”图片生成器</h1>
      <div className="workspace">
        <section aria-label="生成设置">请选择一只宝可梦</section>
        <section aria-label="图片预览">
          <button disabled>下载题面</button>
          <button disabled>下载答案</button>
        </section>
      </div>
    </main>
  );
}
