export const metadata = {
  title: 'EC API',
  description: 'EC — Just Easy. Backend API.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
