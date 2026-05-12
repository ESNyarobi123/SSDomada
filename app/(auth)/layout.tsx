import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-onyx-950 text-white relative overflow-hidden px-4 py-10">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,215,0,0.06) 0%, transparent 65%)" }} />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(255,215,0,0.03) 0%, transparent 65%)" }} />
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: "linear-gradient(rgba(255,215,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.5) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-gold" style={{
            width: Math.random() * 2.5 + 1 + "px",
            height: Math.random() * 2.5 + 1 + "px",
            left: Math.random() * 100 + "%",
            top: Math.random() * 100 + "%",
            opacity: Math.random() * 0.3 + 0.1,
            animation: `float ${Math.random() * 6 + 4}s ease-in-out ${Math.random() * 3}s infinite`,
          }} />
        ))}
      </div>

      {/* Logo */}
      <Link href="/" className="relative z-10 flex items-center gap-3 mb-10 group">
        <div className="relative">
          <Image
            src="/images/SSDomada.png"
            alt="SSDomada"
            width={48}
            height={48}
            className="rounded-xl ring-1 ring-white/10 group-hover:ring-gold-30 transition-all"
          />
          <div className="absolute inset-0 rounded-xl bg-gold-20 opacity-0 group-hover:opacity-100 transition-opacity blur-md scale-110 pointer-events-none" />
        </div>
        <span className="text-xl font-black text-gradient tracking-tight">SSDomada</span>
      </Link>

      {/* Form */}
      <div className="relative z-10 w-full max-w-md page-enter">{children}</div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-center text-xs text-onyx-500">
        <Link href="/" className="text-gold hover:underline">← Back to home</Link>
      </p>
    </div>
  );
}
