import Image from 'next/image'

const logos = [
  { alt: 'NSE', src: 'https://placehold.co/120x40?text=NSE' },
  { alt: 'BSE', src: 'https://placehold.co/120x40?text=BSE' },
  { alt: 'Reuters', src: 'https://placehold.co/120x40?text=Reuters' },
  { alt: 'Moody', src: 'https://placehold.co/120x40?text=Moody' },
  { alt: 'FRED', src: 'https://placehold.co/120x40?text=FRED' },
]

export function LogosStrip() {
  return (
    <section className="w-full py-8 bg-card/30 anchor-offset">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 items-center justify-items-center opacity-70">
          {logos.map((l) => (
            <Image key={l.alt} alt={l.alt} src={l.src} width={120} height={40} className="grayscale" />
          ))}
        </div>
      </div>
    </section>
  )
}
