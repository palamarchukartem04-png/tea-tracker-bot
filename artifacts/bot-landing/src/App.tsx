function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif",
      color: "white",
      padding: "24px",
    }}>
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🍵</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px" }}>
          Tea Tracker Bot
        </h1>
        <p style={{ fontSize: 16, color: "#a0b4c8", margin: "0 0 40px", lineHeight: 1.6 }}>
          Telegram-бот для обліку торгівлі чаєм.<br />
          Відстежуйте закупівлі, продажі та прибуток прямо в месенджері.
        </p>

        <div style={{
          background: "rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: "24px",
          marginBottom: 32,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}>
          {[
            { icon: "📦", label: "Закупівлі", desc: "Фіксуйте нові партії" },
            { icon: "💰", label: "Продажі", desc: "Записуйте виручку" },
            { icon: "📊", label: "Статистика", desc: "Аналіз прибутку" },
            { icon: "💡", label: "Реінвестиції", desc: "Підказки по циклах" },
          ].map((f) => (
            <div key={f.label} style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: "16px 12px",
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</div>
              <div style={{ fontSize: 12, color: "#7a9ab5", marginTop: 4 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(0,200,100,0.15)",
          border: "1px solid rgba(0,200,100,0.3)",
          borderRadius: 100,
          padding: "8px 20px",
          fontSize: 14,
          color: "#4ade80",
          marginBottom: 32,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
          Бот активний та працює 24/7
        </div>

        <p style={{ fontSize: 13, color: "#556677" }}>
          Знайдіть бота в Telegram та надішліть <strong style={{ color: "#7ba7c4" }}>/start</strong>
        </p>
      </div>
    </div>
  );
}

export default App;
