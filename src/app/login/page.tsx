"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al iniciar sesión");
      }

      // Redirigir al dashboard principal
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div className="animate-fade-in" style={cardStyle}>
        
        {/* Logo Section */}
        <div style={logoContainerStyle}>
          <img src="/logo.png" alt="Logo IkalChukum" style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '16px' }} />
          <h1 style={titleStyle}>IkalChukum</h1>
          <p style={subtitleStyle}>Sistema CRM-ERP Modular</p>
        </div>

        {error && (
          <div style={errorContainerStyle}>
            <span style={{ fontSize: "14px" }}>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={inputGroupStyle}>
            <label htmlFor="email" style={labelStyle}>Correo Electrónico</label>
            <input
              id="email"
              type="email"
              placeholder="ejemplo@ikalchukum.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label htmlFor="password" style={labelStyle}>Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={isLoading ? buttonDisabledStyle : buttonStyle}
          >
            {isLoading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>

        <div style={footerStyle}>
          <span>Acceso restringido a personal autorizado.</span>
        </div>
      </div>

      {/* Google Font link */}
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
    </div>
  );
}

// CSS-in-JS styles to maintain strict premium styling without Tailwind dependencies
const containerStyle: React.CSSProperties = {
  backgroundColor: "#080b11",
  backgroundImage: `
    radial-gradient(at 0% 0%, rgba(29, 128, 136, 0.08) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(164, 189, 145, 0.04) 0px, transparent 50%)
  `,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  padding: "20px",
  color: "#f3f4f6",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(18, 24, 38, 0.45)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "24px",
  width: "100%",
  maxWidth: "420px",
  padding: "40px",
  boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5), 0 0 30px rgba(29, 128, 136, 0.05)",
};

const logoContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginBottom: "32px",
  textAlign: "center",
};

const logoStyle: React.CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, #1d8088 0%, #a4bd91 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: "1.6rem",
  color: "#080b11",
  boxShadow: "0 6px 20px rgba(29, 128, 136, 0.3)",
  marginBottom: "16px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.8rem",
  fontWeight: 800,
  letterSpacing: "-0.5px",
  background: "linear-gradient(135deg, #ffffff 0%, #a4bd91 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  marginBottom: "4px",
};

const subtitleStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "0.9rem",
  fontWeight: 500,
};

const errorContainerStyle: React.CSSProperties = {
  backgroundColor: "rgba(239, 68, 68, 0.1)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  borderRadius: "12px",
  color: "#ef4444",
  padding: "12px 16px",
  marginBottom: "24px",
  fontWeight: 500,
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelStyle: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "0.85rem",
  fontWeight: 600,
  letterSpacing: "0.2px",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "rgba(8, 11, 17, 0.5)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  color: "#ffffff",
  padding: "12px 16px",
  fontSize: "0.95rem",
  outline: "none",
  transition: "all 0.2s ease",
  width: "100%",
};

// CSS transitions are handled globally in globals.css, focus styles inline:
const buttonStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #1d8088 0%, #156066 100%)",
  color: "#ffffff",
  border: "none",
  borderRadius: "12px",
  padding: "14px",
  fontSize: "0.95rem",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(29, 128, 136, 0.25)",
  marginTop: "10px",
  transition: "all 0.25s ease",
};

const buttonDisabledStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "rgba(29, 128, 136, 0.4)",
  color: "rgba(255, 255, 255, 0.5)",
  cursor: "not-allowed",
  boxShadow: "none",
};

const footerStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#6b7280",
  fontSize: "0.75rem",
  marginTop: "24px",
};
