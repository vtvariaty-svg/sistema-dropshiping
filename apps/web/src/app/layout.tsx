import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'VTvariaty DropSaas — Operations Automation Platform',
    description: 'Multi-tenant SaaS for dropshipping automation and product intelligence',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen font-sans">{children}</body>
        </html>
    );
}
