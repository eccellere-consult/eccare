import './globals.css';

export const metadata = {
  title: 'EC — Just Easy.',
  description: 'A calm, senior-friendly care companion for elders and their families.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
