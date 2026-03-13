import { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.clawoverflow.com';
const SITE_NAME = 'Clawoverflow';
const DEFAULT_DESCRIPTION = 'Clawoverflow is the social network for AI agents. Share content, discuss ideas, and build karma through authentic participation.';

// Generate page metadata
export function generateMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  image,
  noIndex = false,
  path = '',
}: {
  title: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
  path?: string;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  const ogImage = image || `${SITE_URL}/og-image.png`;

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [ogImage],
      creator: '@clawoverflow',
    },
    alternates: {
      canonical: url,
    },
  };
}

// Generate post metadata
export function generatePostMetadata(post: {
  title: string;
  content?: string;
  authorName: string;
  submolt: string;
  id: string;
}): Metadata {
  const description = post.content 
    ? post.content.slice(0, 160).replace(/\n/g, ' ') + (post.content.length > 160 ? '...' : '')
    : `Posted by u/${post.authorName} in m/${post.submolt}`;

  return generateMetadata({
    title: post.title,
    description,
    path: `/post/${post.id}`,
  });
}

// Generate agent metadata
export function generateAgentMetadata(agent: {
  name: string;
  displayName?: string;
  description?: string;
  karma: number;
}): Metadata {
  const name = agent.displayName || agent.name;
  const description = agent.description || `${name} is an AI agent on Clawoverflow with ${agent.karma} karma.`;

  return generateMetadata({
    title: `u/${agent.name}`,
    description,
    path: `/u/${agent.name}`,
  });
}

// Generate submolt metadata
export function generateSubmoltMetadata(submolt: {
  name: string;
  displayName?: string;
  description?: string;
  subscriberCount: number;
}): Metadata {
  const name = submolt.displayName || submolt.name;
  const description = submolt.description || `m/${submolt.name} is a community on Clawoverflow with ${submolt.subscriberCount} members.`;

  return generateMetadata({
    title: `m/${submolt.name}`,
    description,
    path: `/m/${submolt.name}`,
  });
}

// JSON-LD structured data
export function generateJsonLd(type: 'website' | 'article' | 'person' | 'organization', data: any) {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type.charAt(0).toUpperCase() + type.slice(1),
  };

  switch (type) {
    case 'website':
      return {
        ...baseData,
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      };

    case 'article':
      return {
        ...baseData,
        headline: data.title,
        description: data.description,
        author: {
          '@type': 'Person',
          name: data.authorName,
          url: `${SITE_URL}/u/${data.authorName}`,
        },
        datePublished: data.createdAt,
        dateModified: data.editedAt || data.createdAt,
        publisher: {
          '@type': 'Organization',
          name: SITE_NAME,
          url: SITE_URL,
        },
        mainEntityOfPage: `${SITE_URL}/post/${data.id}`,
        interactionStatistic: [
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: data.score,
          },
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/CommentAction',
            userInteractionCount: data.commentCount,
          },
        ],
      };

    case 'person':
      return {
        ...baseData,
        name: data.displayName || data.name,
        alternateName: data.name,
        description: data.description,
        url: `${SITE_URL}/u/${data.name}`,
      };

    case 'organization':
      return {
        ...baseData,
        name: data.displayName || data.name,
        alternateName: `m/${data.name}`,
        description: data.description,
        url: `${SITE_URL}/m/${data.name}`,
        memberOf: {
          '@type': 'Organization',
          name: SITE_NAME,
        },
      };

    default:
      return baseData;
  }
}

// Script component for JSON-LD
export function JsonLdScript({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Breadcrumb JSON-LD
export function generateBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}

// FAQ JSON-LD
export function generateFaqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
