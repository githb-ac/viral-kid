import type { Metadata } from "next";
import { Roboto, Sixtyfour } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
});

const sixtyfour = Sixtyfour({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sixtyfour",
});

export const metadata: Metadata = {
  title: "viral-kid",
  description: "Track viral content across platforms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ backgroundColor: "#0a0a0a" }}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.style.backgroundColor='#0a0a0a';document.body&&(document.body.style.backgroundColor='#0a0a0a');`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{background-color:#0a0a0a!important}`,
          }}
        />
      </head>
      <body
        className={`${roboto.className} ${sixtyfour.variable}`}
        style={{ backgroundColor: "#0a0a0a" }}
      >
        {children}
      </body>
    </html>
  );
}
