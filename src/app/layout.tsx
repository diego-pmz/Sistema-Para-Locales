import type { Metadata } from "next";
import { montserrat, bebasNeue, caveat } from "@/lib/fonts";
import "./globals.css";
import { SystemBlocker } from "@/components/SystemBlocker";

export const metadata: Metadata = {
  title: "Clásicos Sushi & Street Food",
  description: "Pedidos Online Clásicos - Sushi & Street Food. Sabor que une.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${montserrat.variable} ${bebasNeue.variable} ${caveat.variable} scroll-smooth`}>
      <body className={`font-sans bg-gray-50 antialiased`}>
        <SystemBlocker />
        {children}
      </body>
    </html>
  );
}
