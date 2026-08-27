/* eslint-disable @next/next/no-img-element -- Published Supabase media URLs are runtime-resolved. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedSiteChrome } from "@/lib/cms-content";
import { getPublishedInsightsArticle } from "@/lib/insights-data";
import { renderInsightsBody } from "@/lib/insights-renderer";

export const dynamic = "force-dynamic";

type InsightsArticlePageProps = {
  params: Promise<{ slug: string }>;
};

const insightsFallbackDescription = "Ideas, perspectives, and practical thinking from OCSCO on strategy, design, and technology.";

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
}

export async function generateMetadata({ params }: InsightsArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedInsightsArticle(slug);
  if (!article) return { title: { absolute: "Insights" }, description: insightsFallbackDescription };

  const description = article.excerpt || insightsFallbackDescription;
  const canonical = `/insights/${article.slug}`;
  return {
    title: { absolute: article.title },
    description,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description,
      type: "article",
      url: canonical,
      publishedTime: article.publishedAt,
      images: [{ url: article.coverImageUrl, alt: article.coverImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [article.coverImageUrl],
    },
  };
}

export default async function InsightsArticlePage({ params }: InsightsArticlePageProps) {
  const { slug } = await params;
  const [article, chrome] = await Promise.all([getPublishedInsightsArticle(slug), getPublishedSiteChrome()]);
  if (!article) notFound();

  return (
    <main className="public-insights-page">
      <SiteHeader navigation={chrome.primaryNavigation} ctaHref={chrome.settings.primaryContactPath} />
      <article className="public-insights-article-shell shell">
        <Link className="public-insights-back" href="/insights"><span aria-hidden="true">←</span> Back to Insights</Link>
        <header className="public-insights-article-header">
          <p className="overline overline-dark">{article.categoryName}</p>
          <h1>{article.title}</h1>
          {article.excerpt ? <p className="public-insights-article-excerpt">{article.excerpt}</p> : null}
          <div className="public-insights-article-byline">
            <span>By {article.authorLabel}</span>
            <time dateTime={article.publishedAt}>{formatPublishedDate(article.publishedAt)}</time>
          </div>
        </header>

        <figure className="public-insights-article-cover">
          <img src={article.coverImageUrl} alt={article.coverImageAlt} />
        </figure>

        <div className="public-insights-article-grid">
          <div className="insights-rendered-body public-insights-body">{renderInsightsBody(article.body)}</div>
          <aside className="public-insights-article-aside" aria-label="Article details">
            <div>
              <p className="overline overline-dark">Category</p>
              <p>{article.categoryName}</p>
            </div>
            <div>
              <p className="overline overline-dark">Tags</p>
              {article.tags.length ? <ul>{article.tags.map((tag) => <li key={tag.slug}>{tag.name}</li>)}</ul> : <p>No tags.</p>}
            </div>
          </aside>
        </div>
      </article>
      <SiteFooter positioningStatement={chrome.settings.positioningStatement} ctaHref={chrome.settings.primaryContactPath} />
    </main>
  );
}
