<script lang="ts">
  import {
    BookOpenCheck,
    Database,
    ExternalLink,
    Github,
    Globe,
    Linkedin,
    Mail,
    Users
  } from 'lucide-svelte';

  type LinkItem = {
    label: string;
    href: string;
  };

  type Acknowledgement = {
    name: string;
    role: string;
    links: LinkItem[];
  };

  const contactEmail = 'QuinnKWolter@gmail.com';

  const contactLinks: LinkItem[] = [
    { label: 'Email', href: `mailto:${contactEmail}` },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/quinn-k-wolter-4b68bb8b/'
    },
    { label: 'GitHub', href: 'https://github.com/QuinnKWolter' }
  ];

  const acknowledgements: Acknowledgement[] = [
    {
      name: 'University of Pittsburgh Computational Social Dynamics (PICSO) Lab',
      role: 'Research lab',
      links: [{ label: 'Site', href: 'https://picsolab.github.io/' }]
    },
    {
      name: 'Quinn K Wolter',
      role: 'Lead Researcher & Developer',
      links: [
        { label: 'Site', href: 'https://quinnkwolter.com/' },
        {
          label: 'LinkedIn',
          href: 'https://www.linkedin.com/in/quinn-k-wolter-4b68bb8b/'
        },
        { label: 'GitHub', href: 'https://github.com/QuinnKWolter' },
        { label: 'Email', href: `mailto:${contactEmail}` }
      ]
    },
    {
      name: 'Professor Yu-Ru Lin',
      role: 'Primary Advisor',
      links: [{ label: 'Site', href: 'https://yurulin.com/' }]
    },
    {
      name: 'Radhika Purohit',
      role: 'Developer',
      links: [{ label: 'Site', href: 'https://radhika710.github.io/' }]
    },
    {
      name: 'Chase Lahner',
      role: 'Developer',
      links: [
        { label: 'GitHub', href: 'https://github.com/chase-lahner' },
        { label: 'LinkedIn', href: 'https://www.linkedin.com/in/chase-lahner/' },
        { label: 'Email', href: 'mailto:chase.lahner@pitt.edu' }
      ]
    },
    {
      name: 'Andrew Aquilinas',
      role: 'Developer',
      links: [{ label: 'Site', href: 'https://andaqu.github.io/' }]
    },
    {
      name: 'Yongsu Ahn',
      role: 'Research Advisor',
      links: [{ label: 'Site', href: 'http://yong8.me/' }]
    },
    {
      name: 'Ahana Biswas',
      role: 'Research Advisor',
      links: [{ label: 'Site', href: 'https://biswas-ahana.github.io/' }]
    }
  ];
</script>

<svelte:head>
  <title>About CivicWatch</title>
  <meta
    name="description"
    content="About CivicWatch, including methods, contact, and acknowledgements."
  />
</svelte:head>

<section class="about-page">
  <div class="text-container about-shell">
    <header class="page-header">
      <h1>CivicWatch</h1>
      <p>
        CivicWatch is a public interface for examining communication by U.S.
        state legislators. The project brings together posts, legislator
        metadata, topic labels, state-level summaries, and interaction-derived
        views so that users can inspect patterns across people, places,
        parties, topics, and time.
      </p>
    </header>

    <section class="prose-section" aria-labelledby="project-heading">
      <div class="section-heading">
        <Users size={20} strokeWidth={1.8} aria-hidden="true" />
        <h2 id="project-heading">Project Scope</h2>
      </div>

      <p>
        The interface is intended for public exploration and research review.
        It is not a live social-media monitoring tool, and it should not be
        treated as a complete record of every communication by every state
        legislator. It is a structured view into a restored analytical corpus.
      </p>

      <p>
        The site emphasizes reproducible filtering and comparison. Users can
        move from broad summaries to individual legislators, states, topics, and
        moments, while preserving the active filters in the URL when possible.
      </p>
    </section>

    <section class="prose-section" aria-labelledby="methods-heading">
      <div class="section-heading">
        <BookOpenCheck size={20} strokeWidth={1.8} aria-hidden="true" />
        <h2 id="methods-heading">Methods</h2>
      </div>

      <p>
        CivicWatch is based on a restored analytical corpus, not a live feed.
        The corpus covers January 1, 2020 through December 31, 2024 and contains
        approximately 22.2 million posts, 5,927 legislators, and 22 topic
        categories.
      </p>

      <p>
        Aggregations are served from PostgreSQL base tables, restored
        materialized views, and local exploration views prepared after database
        restore. These prepared views support faster summaries for the public
        interface while retaining links back to the underlying entities where
        available.
      </p>

      <p>
        Topic 999 is labeled Uncategorized and remains visible by default.
        Missing legislator metadata is shown as missing rather than silently
        excluded, so users can see where coverage or public-record fields are
        incomplete.
      </p>
    </section>

    <section class="prose-section" aria-labelledby="data-heading">
      <div class="section-heading">
        <Database size={20} strokeWidth={1.8} aria-hidden="true" />
        <h2 id="data-heading">Data Notes</h2>
      </div>

      <p>
        Legislator names, party labels, chambers, state codes, topic
        classifications, engagement counts, and post text may be incomplete or
        uneven across the corpus. Where fields are absent, the interface
        displays a no-data marker or an explicit unknown category.
      </p>

      <p>
        Topic, state, and legislator summaries are analytical conveniences.
        They should be interpreted as summaries of the dataset as restored, not
        as official legislative records or claims about legislative behavior
        outside the observed posts.
      </p>
    </section>

    <section class="prose-section contact-section" aria-labelledby="contact-heading">
      <div class="section-heading">
        <Mail size={20} strokeWidth={1.8} aria-hidden="true" />
        <h2 id="contact-heading">Contact</h2>
      </div>

      <p>
        For questions about CivicWatch, the dataset, or the research context,
        contact Quinn K Wolter.
      </p>

      <nav class="contact-links" aria-label="Quinn K Wolter contact links">
        {#each contactLinks as link (link.href)}
          <a
            class="icon-link"
            href={link.href}
            title={link.label === 'Email' ? contactEmail : link.label}
            aria-label={link.label === 'Email' ? `Email ${contactEmail}` : link.label}
            target={link.href.startsWith('mailto:') ? undefined : '_blank'}
            rel={link.href.startsWith('mailto:') ? undefined : 'noreferrer'}
          >
            {#if link.label === 'GitHub'}
              <Github size={17} strokeWidth={1.9} aria-hidden="true" />
            {:else if link.label === 'LinkedIn'}
              <Linkedin size={17} strokeWidth={1.9} aria-hidden="true" />
            {:else if link.label === 'Email'}
              <Mail size={17} strokeWidth={1.9} aria-hidden="true" />
            {:else}
              <Globe size={17} strokeWidth={1.9} aria-hidden="true" />
            {/if}
            <span class="sr-only">{link.label}</span>
          </a>
        {/each}
      </nav>
    </section>

    <section class="prose-section" aria-labelledby="acknowledgements-heading">
      <div class="section-heading">
        <Users size={20} strokeWidth={1.8} aria-hidden="true" />
        <h2 id="acknowledgements-heading">Acknowledgements</h2>
      </div>

      <ul class="acknowledgement-list">
        {#each acknowledgements as acknowledgement (acknowledgement.name)}
          <li>
            <div>
              <strong>{acknowledgement.name}</strong>
              <span>{acknowledgement.role}</span>
            </div>

            <nav aria-label={`${acknowledgement.name} links`}>
              {#each acknowledgement.links as link (link.href)}
                <a
                  href={link.href}
                  target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel={link.href.startsWith('mailto:') ? undefined : 'noreferrer'}
                  class="icon-link"
                  title={link.label}
                  aria-label={`${acknowledgement.name} ${link.label}`}
                >
                  {#if link.label === 'GitHub'}
                    <Github size={15} strokeWidth={1.9} aria-hidden="true" />
                  {:else if link.label === 'LinkedIn'}
                    <Linkedin size={15} strokeWidth={1.9} aria-hidden="true" />
                  {:else if link.label === 'Email'}
                    <Mail size={15} strokeWidth={1.9} aria-hidden="true" />
                  {:else if link.label === 'Site'}
                    <Globe size={15} strokeWidth={1.9} aria-hidden="true" />
                  {:else}
                    <ExternalLink size={15} strokeWidth={1.9} aria-hidden="true" />
                  {/if}
                  <span class="sr-only">{link.label}</span>
                </a>
              {/each}
            </nav>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</section>

<style>
  .about-page {
    border-top: 1px solid var(--color-rule);
  }

  .about-shell {
    padding-block: 42px 56px;
  }

  .page-header {
    margin-bottom: 34px;
  }

  h1 {
    margin: 0 0 16px;
    font-size: clamp(2.4rem, 6vw, 4rem);
  }

  .page-header p,
  .prose-section p {
    color: var(--color-mute);
    font-size: 1.02rem;
    line-height: 1.72;
  }

  .page-header p {
    max-width: 820px;
    margin: 0;
  }

  .prose-section {
    padding-block: 26px;
    border-top: 1px solid var(--color-rule);
  }

  .section-heading {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    color: var(--color-seal);
  }

  .section-heading h2 {
    margin: 0;
    color: var(--color-ink);
    font-size: 1.42rem;
  }

  .prose-section p {
    margin: 0 0 14px;
  }

  .prose-section p:last-child {
    margin-bottom: 0;
  }

  .contact-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 2px;
  }

  .acknowledgement-list {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--color-rule);
  }

  .acknowledgement-list li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
    padding-block: 14px;
    border-bottom: 1px solid var(--color-rule);
  }

  .acknowledgement-list strong,
  .acknowledgement-list span {
    display: block;
  }

  .acknowledgement-list strong {
    color: var(--color-ink);
    font-size: 1rem;
  }

  .acknowledgement-list span {
    color: var(--color-mute);
    font-size: 0.94rem;
  }

  .acknowledgement-list nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }

  .icon-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--color-rule);
    border-radius: 6px;
    background:
      color-mix(
        in srgb,
        var(--color-elevated) 86%,
        transparent
      );
    color: var(--color-ink);
    text-decoration: none;
    transition:
      color 140ms ease,
      border-color 140ms ease,
      background-color 140ms ease,
      transform 140ms ease;
  }

  .icon-link:hover {
    border-color:
      color-mix(
        in srgb,
        var(--color-seal) 76%,
        var(--color-rule)
      );
    background:
      color-mix(
        in srgb,
        var(--color-seal) 10%,
        var(--color-elevated)
      );
    color: var(--color-seal);
    transform: translateY(-1px);
  }

  .icon-link:focus-visible {
    outline: 2px solid var(--color-seal);
    outline-offset: 2px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    white-space: nowrap;
    border: 0;
    clip: rect(0 0 0 0);
  }

  @media (max-width: 720px) {
    .about-shell {
      padding-block: 32px 44px;
    }

    .acknowledgement-list li {
      grid-template-columns: 1fr;
    }

    .acknowledgement-list nav {
      justify-content: flex-start;
    }
  }
</style>
