import { getCollection, type CollectionEntry } from 'astro:content';

export type Note = CollectionEntry<'primers'>;

/**
 * Topics, in the order they appear on /primers/. A topic's notes live in
 * src/content/primers/<slug>/. Adding a topic means adding it here and making the folder.
 */
export const topics = [
  {
    slug: 'networking',
    title: 'Networking',
    blurb: 'How networks are put together, starting from the addresses.',
  },
  {
    slug: 'philosophy',
    title: 'Philosophy',
    blurb: 'The history of ideas, starting with the first people to ask what everything is made of.',
    slug: 'containers',
    title: 'Containers',
    blurb: 'What runs your containers, and how to choose the tooling around them.',
  },
  {
    slug: 'practices',
    title: 'Practices',
    blurb: 'How engineering work gets done well, and how to check that it was.',
  },
  {
    slug: 'working-with-ai',
    title: 'Working with AI',
    blurb: 'How to set up AI assistants so their work can be trusted and checked.',
  },
];

export type Topic = (typeof topics)[number];

const topicOf = (note: Note) => note.id.split('/')[0];
export const noteSlug = (note: Note) => note.id.split('/').slice(1).join('/');
export const noteUrl = (note: Note) => `/primers/${note.id}/`;
/** Position within its topic, as two digits: note 2 = "02". */
export const pos = (i: number) => String(i + 1).padStart(2, '0');

/** Published notes for a topic, in reading order. */
export async function topicNotes(topic: string) {
  return (await getCollection('primers', (n) => !n.data.draft && topicOf(n) === topic)).sort(
    (a, b) => a.data.order - b.data.order,
  );
}

/** Topics that have at least one published note, each with its notes. */
export async function publishedTopics() {
  const out = [];
  for (const topic of topics) {
    const notes = await topicNotes(topic.slug);
    if (notes.length) out.push({ topic, notes });
  }
  return out;
}

/**
 * Optional groups on a topic's page (Decision 0009), in display order, listing notes by
 * slug. A slug that isn't published yet is skipped, and a published note that isn't
 * listed lands in a final "More" group, so a new primer never disappears. Topics with no
 * entry here show one plain list.
 */
export const sections: Record<string, { title: string; blurb?: string; notes: string[] }[]> = {
  networking: [
    {
      title: 'Foundations',
      blurb: 'How a request finds its way: layers, addresses, and names.',
      notes: ['osi-model', 'ip-addresses-and-cidr', 'dns-resolution'],
    },
    {
      title: 'Getting traffic to an app',
      blurb: 'What sits in front of an application: load balancers, CDNs, and proxies.',
      notes: ['load-balancers-and-tls', 'cdns-and-cloudfront', 'proxies-and-bastions'],
    },
    {
      title: 'Encryption and trust',
      blurb: 'How HTTPS proves who a server is and keeps the conversation private.',
      notes: ['certificates-and-trust', 'tls-handshake'],
    },
    {
      title: 'AWS networking',
      blurb: "The same ideas inside AWS: VPCs, reaching private resources, and firewalls. Skip this part if you don't use AWS.",
      notes: ['aws-vpc-subnets', 'reaching-private-resources', 'firewalls'],
    },
  ],
};

/** A topic's notes split into its sections, each note keeping its reading-order position. */
export function sectionedNotes(topic: string, notes: Note[]) {
  const groups = sections[topic];
  if (!groups) return [{ title: null as string | null, blurb: undefined as string | undefined, id: '', notes }];
  const bySlug = new Map(notes.map((n) => [noteSlug(n), n]));
  const used = new Set<string>();
  const out: { title: string | null; blurb?: string; id: string; notes: Note[] }[] = [];
  const ids = new Set<string>();
  const idFor = (title: string) => {
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
    ids.add(id);
    return id;
  };
  for (const g of groups) {
    const list = g.notes.flatMap((slug) => {
      const n = bySlug.get(slug);
      if (!n) return [];
      used.add(slug);
      return [n];
    });
    list.sort((a, b) => a.data.order - b.data.order);
    if (list.length) out.push({ title: g.title, blurb: g.blurb, id: idFor(g.title), notes: list });
  }
  const rest = notes.filter((n) => !used.has(noteSlug(n)));
  if (rest.length) out.push({ title: 'More', id: idFor('More'), notes: rest });
  return out;
}

/** The most recently updated notes across every topic, newest first. */
export async function recentlyUpdated(limit = 5) {
  const all = (await publishedTopics()).flatMap(({ topic, notes }) => notes.map((note) => ({ topic, note })));
  return all
    .sort((a, b) => b.note.data.updated.getTime() - a.note.data.updated.getTime() || a.note.data.order - b.note.data.order)
    .slice(0, limit);
}
