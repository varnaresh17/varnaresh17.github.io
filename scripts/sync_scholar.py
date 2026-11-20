"""Fetch public Scholar data through SerpApi; never publish credentials or raw responses."""
import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
AUTHOR = 'GbwKoHsAAAAJ'
PROFILE = f'https://scholar.google.com/citations?user={AUTHOR}'


def title_key(value):
    return ''.join(c.lower() for c in unicodedata.normalize('NFKC', str(value)) if c.isalnum())


def count(value):
    if isinstance(value, str):
        value = value.replace(',', '')
        if not value.isdigit():
            return None
        value = int(value)
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None


def scholar_url(value):
    try:
        url = urllib.parse.urlsplit(str(value))
        if url.scheme == 'https' and url.netloc == 'scholar.google.com' and url.path in ('/citations', '/scholar'):
            return url.geturl()
    except ValueError:
        pass
    return None


def clean_article(raw):
    if not isinstance(raw, dict):
        raise ValueError('Malformed article')
    identity = str(raw.get('citation_id', ''))
    if not re.fullmatch(re.escape(AUTHOR) + r':[\w-]+', identity):
        raise ValueError('Article belongs to a different Scholar profile')
    title = str(raw.get('title', '')).strip()
    if not title:
        raise ValueError('Article title is missing')
    cited = raw.get('cited_by') or {}
    return {
        'id': identity, 'title': title[:2000],
        'authors': str(raw.get('authors', ''))[:2000],
        'publication': str(raw.get('publication', ''))[:2000],
        'year': str(raw.get('year') or '')[:4],
        'citations': count(cited.get('value')),
        'url': scholar_url(raw.get('link')) or f'{PROFILE}&view_op=view_citation&citation_for_view={urllib.parse.quote(identity)}',
        'citingUrl': scholar_url(cited.get('link')),
    }


def build_snapshot(payload, all_articles, bibliography, previous, overrides, now):
    if payload.get('search_parameters', {}).get('author_id', AUTHOR) != AUTHOR:
        raise ValueError('Wrong author profile')
    author = payload.get('author')
    metrics = payload.get('cited_by')
    if not isinstance(author, dict) or not author.get('name') or not isinstance(metrics, dict):
        raise ValueError('Incomplete Scholar response; preserving last successful snapshot')
    summary = {}
    for row in metrics.get('table', []):
        for key in ('citations', 'h_index', 'i10_index'):
            if key in row:
                summary[key] = {'all': count(row[key].get('all')), 'recent': next((count(v) for k, v in row[key].items() if k != 'all'), None)}
    if any(summary.get(k, {}).get('all') is None for k in ('citations', 'h_index', 'i10_index')):
        raise ValueError('Missing citation metrics; preserving last successful snapshot')
    articles = [clean_article(a) for a in all_articles]
    if not articles or len({a['id'] for a in articles}) != len(articles):
        raise ValueError('Empty or duplicate article list')
    prior = {a['id']: a for a in previous.get('articles', [])}
    for article in articles:
        old = prior.get(article['id'], {})
        article['firstSeen'] = old.get('firstSeen') or now
        before, after = count(old.get('citations')), article['citations']
        article['change'] = after - before if before is not None and after is not None else None
    lookup = {}
    for a in articles:
        lookup.setdefault(title_key(a['title']), []).append(a)
    by_id = {a['id']: a for a in articles}
    publication_map, used, match_count = {}, set(), 0
    for paper in bibliography['papers'] + bibliography['contributions']:
        if paper.get('type') not in ('journal', 'proceeding'):
            continue
        candidates = lookup.get(title_key(paper['title']), [])
        # Use exact normalized titles and compatible years, never an unverified fuzzy guess.
        candidates = [a for a in candidates if not a['year'] or not paper.get('year') or a['year'] == str(paper['year'])]
        explicit = overrides.get(paper['id'])
        if explicit:
            if explicit not in by_id:
                raise ValueError('Configured Scholar article mapping not found')
            candidates = [by_id[explicit]]
        if len(candidates) == 1:
            publication_map[paper['id']] = candidates[0]['id']
            used.add(candidates[0]['id'])
            match_count += 1
    graph = []
    for row in metrics.get('graph', []):
        year, citations = count(row.get('year')), count(row.get('citations'))
        if year and 1900 <= year <= 2200 and citations is not None:
            graph.append({'year': year, 'citations': citations})
    recent_keys = [k for row in metrics.get('table', []) for val in row.values() if isinstance(val, dict) for k in val if k != 'all']
    return {
        'version': 1, 'status': 'ready', 'profileUrl': PROFILE,
        'updatedAt': now, 'previousUpdatedAt': previous.get('updatedAt'),
        'source': 'Google Scholar via SerpApi', 'author': {'name': str(author['name'])[:300]},
        'metrics': summary, 'recentLabel': next(iter(recent_keys), 'recent').replace('_', ' ').capitalize(),
        'citationsByYear': sorted(graph, key=lambda a: a['year']),
        'articles': articles, 'publicationMap': publication_map,
        'additionalArticleIds': [a['id'] for a in articles if a['id'] not in used],
        'matchedPublications': match_count,
    }


def fetch_profile(api_key):
    combined, first = [], None
    for page in range(10):
        params = urllib.parse.urlencode({'engine': 'google_scholar_author', 'author_id': AUTHOR, 'hl': 'en', 'num': 100, 'start': page * 100, 'api_key': api_key})
        request = urllib.request.Request('https://serpapi.com/search.json?' + params, headers={'User-Agent': 'NareshResearchWebsite/1.0'})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError):
            # urllib exception strings may contain the authenticated URL; don't log them.
            raise ValueError('Scholar request failed. Check the SerpApi account quota and secret; the existing snapshot is unchanged.') from None
        if data.get('error') or data.get('search_metadata', {}).get('status') != 'Success':
            raise ValueError('SerpApi did not return a successful profile; the existing snapshot is unchanged.')
        page_articles = data.get('articles')
        if not isinstance(page_articles, list):
            raise ValueError('Incomplete article list')
        first = first or data
        combined.extend(page_articles)
        pagination = data.get('serpapi_pagination') or {}
        if not pagination.get('next') and not pagination.get('next_link') and len(page_articles) < 100:
            return first, combined
    raise ValueError('Profile pagination limit reached; preserving the existing snapshot')


def main():
    api_key = os.environ.get('SERPAPI_API_KEY', '').strip()
    if not api_key:
        print('::error::Add the SERPAPI_API_KEY repository Actions secret to enable citation syncing. No files were changed.')
        return 1
    try:
        payload, articles = fetch_profile(api_key)
        target = ROOT / 'scholar-data.json'
        previous = json.loads(target.read_text()) if target.exists() else {}
        snapshot = build_snapshot(payload, articles, json.loads((ROOT / 'publications.json').read_text()), previous, json.loads((ROOT / 'scholar-mappings.json').read_text()), dt.datetime.now(dt.timezone.utc).isoformat())
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(target)
        print(f"Synced {len(snapshot['articles'])} Scholar articles; matched {snapshot['matchedPublications']} curated publications.")
    except (ValueError, KeyError, TypeError, OSError):
        print('::error::Citation update failed validation or could not reach SerpApi. Check the account and secret. Last successful data have been preserved.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
