import '@/styles/poster.css';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:wght@700&family=Cardo:ital,wght@0,400;0,700;1,400&family=Poppins:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Great+Vibes&family=Playball&family=Cormorant+Garamond:ital,wght@0,600;0,700;1,700&family=Montserrat:wght@500;600&display=block';

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS} precedence="default" />
      {children}
    </>
  );
}
