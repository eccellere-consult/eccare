import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { DemoPeople } from './accounts';
import { at, type Tally } from './helpers';

/** Marker so the demo's quotes can be found and removed again. */
export const DEMO_QUOTE_MARKER = 'demo-data';

interface Video { id: string; title: string; author: string; category: 'yoga' | 'exercise' | 'meditation'; about: string }

/** Real, public YouTube videos for seniors (each one checked to exist and be embeddable). */
export const DEMO_WELLNESS_VIDEOS: Video[] = [
  { id: 'RjqME9aAOpA', title: 'The Best 20-Minute Chair Yoga for Seniors', author: 'Yoga ETC with Tina', category: 'yoga', about: 'Full-body strength, balance and mobility from a chair.' },
  { id: '2IuWm9wKqAk', title: 'Chair Yoga Practice for Seniors (20-Minute Routine)', author: 'YMCA North', category: 'yoga', about: 'A calm, easy-to-follow routine. All you need is a chair.' },
  { id: 'e6QHRS7DR3k', title: 'Chair Yoga for Restricted Mobility and Seniors 65+', author: 'Yoga by Kierstie Payge', category: 'yoga', about: 'Designed for limited mobility, twenty minutes.' },
  { id: 'TxmbX8CXipw', title: '20-Minute Chair Yoga for Seniors and Desk Workers', author: 'Flow with Ali', category: 'yoga', about: 'A simple flow that is accessible for beginners.' },
  { id: 't3CQ6qch-G4', title: 'Gentle Morning Yoga for Seniors and Beginners', author: 'Yoga ETC with Tina', category: 'yoga', about: 'A 13-minute wake-up flow.' },
  { id: 'iylk12bmlpY', title: 'Quick Morning Stretch Routine for Seniors (5 minutes)', author: 'More Life Health Seniors', category: 'exercise', about: 'A short stretch to leave you limber for the day.' },
  { id: 'JWj2ni8UCZw', title: '15-Minute Gentle Morning Routine for Seniors', author: 'Get Lean With Me', category: 'exercise', about: 'Easy, energising and equipment-free.' },
  { id: 'FZqVi9knjr8', title: '10-Minute Morning Unlock and Stretch for Seniors', author: 'Fitness With Cindy', category: 'exercise', about: 'Eases stiffness after a night of sleep.' },
  { id: 'GsprrHXu62A', title: '10-Minute Seated Morning Stretches for Seniors', author: 'AIM Fitness', category: 'exercise', about: 'Simple stretches you can do sitting down.' },
  { id: 'ltEUtDlDiAY', title: 'Gentle Tai Chi Morning Flow for Better Balance', author: 'Yes2Next', category: 'exercise', about: 'A 15-minute flow focused on balance.' },
  { id: 'nFSqub-TGgo', title: '20-Minute Chair Exercise Routine for Seniors', author: 'ElderfitTV', category: 'exercise', about: 'A full-body chair workout.' },
  { id: 'Lzvj_JVZkzY', title: 'Gentle Meditation for Seniors: Breathe Away Tension', author: 'Yes2Next', category: 'meditation', about: 'Ten minutes of guided breathing.' },
  { id: '-NucSdbeIdY', title: 'Best Meditation for Seniors (10 minutes)', author: 'Unplug Meditation', category: 'meditation', about: 'A guided session on your timeless inner sense of self.' },
  { id: '39nHN5YI5EE', title: 'Harmony at Every Age: A Guided Meditation for Seniors', author: 'GoGoGrandparent', category: 'meditation', about: 'A gentle session to promote peace and vitality.' },
  { id: 'L5LWWjkAY9w', title: 'Mindfulness Meditation for Older Adults', author: 'Mindful Aging', category: 'meditation', about: 'Connect with your body and your breath.' },
  { id: 'YlHb4vsdY_g', title: 'Seated Stretches and Meditation to Relax and Reduce Stress', author: 'AIM Fitness', category: 'meditation', about: 'A calm end-of-day routine that can help with sleep.' },
];
export const DEMO_WELLNESS_URLS = DEMO_WELLNESS_VIDEOS.map((v) => `https://www.youtube.com/watch?v=${v.id}`);

const APPROVED_QUOTES = [
  'A phone call to someone you love is never a small thing.', 'Slow mornings and a warm cup of tea are their own kind of wealth.', 'Every day is a fresh chance to smile at someone who needs it.',
  'The people who ask about your day are the ones worth telling.', 'Small joys, noticed often, add up to a rich life.', 'You have survived every hard day so far — that counts for something.',
  'Being remembered by name is one of life’s quiet gifts.', 'A little sunshine on your face is worth stepping outside for.', 'Old friends and old songs both know the way back to your heart.',
  'Today does not need to be big — it just needs to be yours.', 'Gratitude turns an ordinary afternoon into an occasion.', 'The best conversations happen when nobody is in a hurry.',
  'Rest is not laziness — it is how you keep going.', 'Someone, somewhere, is glad you are their family.', 'A garden grows a little every day, even when you are not looking.',
  'After rain, the whole street smells like a new beginning.', 'A shared meal turns neighbours into family.', 'Wisdom is just kindness that has had time to practise.',
  'The courtyard lamp is lit every evening, so someone always knows the way home.', 'Laughter is a good medicine and it has no side effects.', 'A walk to the end of the road and back is a journey too.',
  'Stories told over a cup of tea are the true family heirlooms.', 'Peace is a quiet verandah and a good book.', 'Every sunrise is a gentle reminder to begin again.',
  'You are never too old to learn a new song or make a new friend.', 'Home is wherever someone is waiting to hear your day.', 'A kind word costs nothing and is remembered for years.',
  'The moon looks the same from every window, and so does love.', 'Little by little, a good habit becomes a good life.', 'Be gentle with yourself today; you have done enough.',
];

/** Daily quotes (some already shown, some waiting, some for the admin to review) and the wellness videos. */
export async function buildAdminContent(p: DemoPeople, tally: Tally) {
  const used = 22;
  const quotes: Prisma.DailyQuoteCreateManyInput[] = APPROVED_QUOTES.map((text, i) => ({
    text, author: null, generatedBy: DEMO_QUOTE_MARKER, status: 'approved',
    usedOn: i < used ? new Date(`${at(-(used - i)).toISOString().slice(0, 10)}T00:00:00.000Z`) : null, createdAt: at(-95 + i),
  }));
  quotes.push(
    { text: 'A neighbour’s smile is the first medicine of the day.', author: null, generatedBy: DEMO_QUOTE_MARKER, status: 'pending', usedOn: null, createdAt: at(-2) },
    { text: 'Every elder is a library that has not yet been fully read.', author: null, generatedBy: DEMO_QUOTE_MARKER, status: 'pending', usedOn: null, createdAt: at(-2) },
    { text: 'Hot tea, cool breeze, good company.', author: null, generatedBy: DEMO_QUOTE_MARKER, status: 'pending', usedOn: null, createdAt: at(-1) },
    { text: 'Age is only a number that the heart refuses to count.', author: null, generatedBy: DEMO_QUOTE_MARKER, status: 'rejected', usedOn: null, createdAt: at(-20) },
    { text: 'Never give up!!!', author: null, generatedBy: DEMO_QUOTE_MARKER, status: 'rejected', usedOn: null, createdAt: at(-20) },
  );
  await prisma.dailyQuote.createMany({ data: quotes });
  tally.add('Daily quotes (shown, waiting, pending review)', quotes.length);

  await prisma.wellnessVideo.createMany({
    data: DEMO_WELLNESS_VIDEOS.map((v, i) => ({
      title: v.title, category: v.category, youtubeUrl: `https://www.youtube.com/watch?v=${v.id}`,
      description: `${v.about} By ${v.author}.`, isActive: true, addedById: p.adminId, createdAt: at(-80 + i * 3),
    })),
  });
  tally.add('Wellness videos (yoga, exercise, meditation)', DEMO_WELLNESS_VIDEOS.length);
}
