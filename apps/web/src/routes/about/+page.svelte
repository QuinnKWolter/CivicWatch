<script lang="ts">
  import {
    BookOpenCheck,
    Database,
    ExternalLink,
    Github,
    Globe,
    Linkedin,
    Mail,
    ShieldCheck,
    Users
  } from 'lucide-svelte';
  import { appPath } from '$lib/paths';

  type LinkItem = {
    label: string;
    href: string;
  };

  type Acknowledgement = {
    name: string;
    role: string;
    links: LinkItem[];
  };

  const contactEmail = 'QuinnKWolter@pitt.edu';

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
    },
    {
      name: 'Yuehong Cassandra Tai',
      role: 'Original Dataset Author',
      links: [{ label: 'Site', href: 'https://cassyuehtai.netlify.app/' }]
    },
    {
      name: 'Nitheesha Nakka',
      role: 'Original Dataset Author',
      links: []
    },
    {
      name: 'Khushi Navin Patni',
      role: 'Original Dataset Author',
      links: []
    },
    {
      name: 'Sarah Rajtmajer',
      role: 'Original Dataset Author',
      links: [{ label: 'Site', href: 'https://www.rajtmajerlab.net/' }]
    },
    {
      name: 'Kevin Munger',
      role: 'Original Dataset Author',
      links: [{ label: 'Site', href: 'http://www.kevinmunger.com/' }]
    },
    {
      name: 'Bruce A. Desmarais',
      role: 'Original Dataset Author',
      links: [{ label: 'Site', href: 'https://brucedesmarais.com/' }]
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

      <p>
        This project extends the dataset documented in Yuehong Cassandra Tai,
        Nitheesha Nakka, Khushi Navin Patni, Sarah Rajtmajer, Kevin Munger,
        Yu-Ru Lin, and Bruce A. Desmarais,
        <a
          href="https://www.nature.com/articles/s41597-025-05857-1"
          target="_blank"
          rel="noreferrer"
        >
          "The Digitally Accountable Public Representation Database: Online
          Communication by U.S. Officials"
        </a>,
        Scientific Data, vol. 12, article 1556 (2025).
      </p>

      <p>
        We thank the authors, especially Dr. Desmarais, Dr. Tai, Dr.
        Rajtmajer, and Dr. Lin, for their substantial support in compiling the
        initial version of this dataset and for providing critical feedback on
        key features of the present visualization.
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

      <a
        class="contact-link"
        href={`mailto:${contactEmail}`}
        aria-label={`Email ${contactEmail}`}
      >
        <Mail size={18} strokeWidth={2} aria-hidden="true" />
        <span>{contactEmail}</span>
      </a>
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

    <section class="prose-section funding-section" aria-labelledby="funding-heading">
      <div class="section-heading">
        <ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" />
        <h2 id="funding-heading">Funding</h2>
      </div>

      <div class="funding-content">
        <img
          src={appPath('/nsf.png')}
          alt="National Science Foundation logo"
          width="96"
          height="96"
          loading="lazy"
        />

        <p>
          We are grateful for the support of the
          <a
            href="https://www.nsf.gov/awardsearch/show-award?AWD_ID=2318461"
            target="_blank"
            rel="noreferrer"
          >
            National Science Foundation (NSF #2318461)
          </a>
          and
          <a
            href="https://brightinitiative.com/partners-stories/civicwatch-helping-researchers-understand-how-public-officials-communicate-online"
            target="_blank"
            rel="noreferrer"
          >
            the Bright Initiative
          </a>.
          Any opinions, findings, and conclusions or recommendations expressed
          in this material do not necessarily reflect the views of the funding
          sources.
        </p>
      </div>
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
    margin: 0 0 14px;
  }

  .page-header p:last-child {
    margin-bottom: 0;
  }

  .page-header a,
  .prose-section a:not(.icon-link):not(.contact-link) {
    color: var(--color-seal);
    font-weight: 750;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
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

  .contact-link {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 42px;
    padding: 0 14px;
    margin-top: 2px;
    color: var(--color-seal);
    font-weight: 850;
    line-height: 1;
    text-decoration: none;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-seal) 16%, var(--color-elevated)),
        color-mix(in srgb, var(--color-seal) 10%, var(--color-elevated))
      );
    border: 1px solid
      color-mix(in srgb, var(--color-seal) 58%, var(--color-rule));
    border-radius: 7px;
    box-shadow:
      0 10px 28px rgb(0 0 0 / 12%);
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  .contact-link:hover {
    border-color: var(--color-seal);
    box-shadow:
      0 14px 34px rgb(0 0 0 / 16%);
    transform: translateY(-1px);
  }

  .contact-link:focus-visible {
    outline: 2px solid var(--color-seal);
    outline-offset: 3px;
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

  .funding-section {
    padding-bottom: 0;
  }

  .funding-content {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 18px;
    align-items: center;
    max-width: 900px;
    padding: 18px;
    border: 1px solid var(--color-rule);
    border-radius: 8px;
    background:
      color-mix(
        in srgb,
        var(--color-elevated) 74%,
        transparent
      );
  }

  .funding-content img {
    display: block;
    width: 82px;
    height: auto;
  }

  .funding-content p {
    margin: 0;
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

    .funding-content {
      grid-template-columns: 1fr;
      gap: 14px;
      padding: 16px;
    }

    .funding-content img {
      width: 76px;
    }
  }
</style>
