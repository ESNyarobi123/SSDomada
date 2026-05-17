"use client";

import { useEffect, useState } from "react";

export default function SwaggerDocsPage() {
  const [activeTab, setActiveTab] = useState<"reseller" | "admin" | "portal" | "platform">("reseller");

  useEffect(() => {
    // Load Swagger UI CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css";
    document.head.appendChild(link);

    // Load Swagger UI JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js";
    script.onload = () => {
      initSwagger(activeTab);
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    initSwagger(activeTab);
  }, [activeTab]);

  function initSwagger(tab: string) {
    const urls: Record<string, string> = {
      reseller: "/api/v1/reseller/docs",
      admin: "/api/v1/admin/docs",
      portal: "/api/docs/portal",
      platform: "/api/docs/platform",
    };

    if (typeof window !== "undefined" && (window as any).SwaggerUIBundle) {
      (window as any).SwaggerUIBundle({
        url: urls[tab],
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          (window as any).SwaggerUIBundle.presets.apis,
          (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset,
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: -1,
        docExpansion: "list",
        filter: true,
        tryItOutEnabled: true,
      });
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: "24px 32px",
          color: "white",
          borderBottom: "3px solid #3b82f6",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
                📡 SSDomada API Documentation
              </h1>
              <p style={{ margin: "6px 0 0", opacity: 0.7, fontSize: 14 }}>
                WiFi Billing System — Multi-Tenant Backend APIs
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 12, opacity: 0.6 }}>
              <span>v1.0.0</span>
              <span>•</span>
              <span>OpenAPI 3.0</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            {[
              { id: "reseller" as const, label: "Reseller API", icon: "🏪" },
              { id: "admin" as const, label: "Admin API", icon: "👑" },
              { id: "portal" as const, label: "Portal & Cron", icon: "📶" },
              { id: "platform" as const, label: "Auth & Public", icon: "🔐" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px 8px 0 0",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  transition: "all 0.2s",
                  background: activeTab === tab.id ? "#ffffff" : "rgba(255,255,255,0.1)",
                  color: activeTab === tab.id ? "#0f172a" : "rgba(255,255,255,0.8)",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Swagger UI Container */}
      <div style={{ maxWidth: 1200, margin: "0 auto", minHeight: "80vh" }}>
        <div id="swagger-ui" />
      </div>

      {/* Custom CSS overrides */}
      <style>{`
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .scheme-container { padding: 15px 0; }
        .swagger-ui .opblock-tag { font-size: 18px !important; border-bottom: 2px solid #e2e8f0; }
        .swagger-ui .opblock { border-radius: 8px; margin-bottom: 8px; }
        .swagger-ui .opblock .opblock-summary { padding: 10px 15px; }
        .swagger-ui .btn.execute { background: #3b82f6; border-color: #3b82f6; border-radius: 6px; }
        .swagger-ui .btn.authorize { background: #10b981; border-color: #10b981; border-radius: 6px; }
        .swagger-ui select { border-radius: 6px; }
        .swagger-ui input[type=text] { border-radius: 6px; }
        .swagger-ui textarea { border-radius: 6px; }
      `}</style>
    </div>
  );
}
