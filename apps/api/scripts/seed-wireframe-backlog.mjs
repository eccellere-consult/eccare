import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ITEMS = [
  {
    title: 'Banking / Paytm access',
    description: '[Phase F] Wireframe #1. Elder-facing view into bank/UPI balance and quick actions via Paytm or similar. Needs partnership/API scoping — financial data, treat as high-sensitivity.',
    priority: 'low',
  },
  {
    title: 'Personal care / grooming category in local directory',
    description: '[Phase A2] Wireframe #2. Extend LocalListing categories to include personal care/grooming providers alongside plumber/electrician.',
    priority: 'medium',
  },
  {
    title: 'Home management services (cleaning/nurse/maid via Urban Company)',
    description: '[Phase A2] Wireframe #3. Extend consolidator deep-link connect to include Urban Company; extend LocalListing categories for nurse/maid.',
    priority: 'medium',
  },
  {
    title: 'Video calling (upgrade chat to include video)',
    description: '[Phase D] Wireframe #4. Extend per-neighborhood/family chat with video calling, on top of the Phase A2 text chat.',
    priority: 'medium',
  },
  {
    title: 'Cab / travel booking (Air / Taxi / Road)',
    description: '[Phase A2] Wireframe #5. Deep-link cab booking (Ola/Uber) alongside Porter/Swiggy/Zomato/Instamart. Flight/train booking is a stretch item, likely Phase F.',
    priority: 'medium',
  },
  {
    title: 'Home automation control (smart lights, Google Home, cleaning robots)',
    description: '[Phase F] Wireframe #6. New capability, not previously scoped — control of smart-home devices from the elder home screen.',
    priority: 'low',
  },
  {
    title: 'Social / entertainment discovery (local events, movies, gifting)',
    description: '[Phase D] Wireframe #7. Extend richer chat/social work to include local event and movie discovery plus a gifting flow.',
    priority: 'low',
  },
  {
    title: 'Large dial pad (accessibility calling mode)',
    description: '[Phase A] Wireframe #8. Big-button phone dialer on the elder home screen — small, high-value accessibility win, can ship alongside existing SOS/Family Call work.',
    priority: 'high',
  },
  {
    title: 'Music / radio player',
    description: '[Phase F] Wireframe #9. New capability, not previously scoped — simple music/radio playback for the elder home screen.',
    priority: 'low',
  },
  {
    title: 'SOS routing to registered healthcare provider',
    description: '[Phase C] Wireframe #10-11. Once ServiceProvider/ServiceRequest exists, route emergency geo-location + notify-contacts flow to an assigned healthcare provider, not just family. Core SOS + geo-location + notify-contacts already shipped in Phase A.',
    priority: 'medium',
  },
  {
    title: 'Money transfer from relatives',
    description: '[Phase F] Wireframe #12. Family-initiated money transfer to elder. Needs payment-partner scoping (Razorpay/similar) — high-sensitivity, do not build ad hoc.',
    priority: 'low',
  },
  {
    title: 'Diagnostics / pharma / doctor integrations (Practo, Thyrocare, PharmEasy)',
    description: '[Phase C] Wireframe #13. Named integrations for the ecosystem/provider portal — diagnostics booking, pharmacy orders, doctor discovery.',
    priority: 'medium',
  },
  {
    title: 'Shopping / groceries (ecommerce, Dunzo, local delivery)',
    description: '[Phase A2] Wireframe #14. Extend consolidator deep-link connect to include Dunzo and general ecommerce/grocery delivery.',
    priority: 'medium',
  },
];

async function main() {
  const maxPosition = await prisma.backlogItem.aggregate({
    where: { status: 'backlog' },
    _max: { position: true },
  });
  let position = (maxPosition._max.position ?? -1) + 1;

  for (const item of ITEMS) {
    const existing = await prisma.backlogItem.findFirst({ where: { title: item.title } });
    if (existing) {
      console.log(`Skip (already exists): ${item.title}`);
      continue;
    }
    await prisma.backlogItem.create({
      data: { ...item, status: 'backlog', position: position++ },
    });
    console.log(`Created: ${item.title}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
