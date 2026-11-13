import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const font = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Vistoria 3D — gestão para estética automotiva',
  description: 'Ordens de serviço com vistoria 3D, clientes, veículos, serviços e estoque.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${font.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
