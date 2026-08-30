import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Hermes Agent ARI",
    description: "Hermes intelligent agent command center",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}