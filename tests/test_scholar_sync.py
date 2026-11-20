import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('sync_scholar', Path(__file__).parents[1] / 'scripts' / 'sync_scholar.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ScholarSyncTests(unittest.TestCase):
    def setUp(self):
        self.article = {'citation_id': m.AUTHOR + ':abc', 'title': 'CsPbBr₃ – blue emission', 'authors': 'V Naresh', 'year': '2025', 'cited_by': {'value': 12, 'link': 'https://scholar.google.com/scholar?cites=123'}}
        self.payload = {'search_parameters': {'author_id': m.AUTHOR, 'api_key': 'private-never-export'}, 'author': {'name': 'Naresh Varnakavi'}, 'cited_by': {'table': [{'citations': {'all': 4000, 'since_2021': 3000}}, {'h_index': {'all': 25, 'since_2021': 23}}, {'i10_index': {'all': 32, 'since_2021': 30}}], 'graph': [{'year': 2025, 'citations': '500'}]}}
        self.bib = {'papers': [{'id': 'p01', 'title': 'CsPbBr3: blue emission', 'year': '2025', 'type': 'journal'}], 'contributions': []}
    def build(self, articles=None, previous=None, overrides=None):
        return m.build_snapshot(self.payload, articles or [self.article], self.bib, previous or {}, overrides or {}, '2026-11-20T00:00:00+00:00')
    def test_normalized_title_matching_and_metrics(self):
        data = self.build()
        self.assertEqual(data['publicationMap'], {'p01': m.AUTHOR + ':abc'})
        self.assertEqual(data['metrics']['h_index']['all'], 25)
        self.assertIsNone(data['articles'][0]['change'])
        self.assertNotIn('private-never-export', str(data))
    def test_unknown_is_not_zero(self):
        self.article['cited_by'] = {}
        self.assertIsNone(self.build()['articles'][0]['citations'])
        self.article['cited_by'] = {'value': 0}
        self.assertEqual(self.build()['articles'][0]['citations'], 0)
    def test_duplicate_titles_are_not_guessed(self):
        other = copy.deepcopy(self.article);other['citation_id'] = m.AUTHOR + ':other'
        data = self.build([self.article, other])
        self.assertEqual(data['publicationMap'], {})
        self.assertEqual(len(data['additionalArticleIds']), 2)
    def test_wrong_year_does_not_match(self):
        self.article['year'] = '2024'
        self.assertEqual(self.build()['publicationMap'], {})
    def test_explicit_mapping_resolves_title_variation(self):
        self.article['title'] = 'A different indexed title'
        self.assertEqual(self.build(overrides={'p01': self.article['citation_id']})['matchedPublications'], 1)
    def test_wrong_profile_is_rejected(self):
        self.article['citation_id'] = 'wrong:abc'
        with self.assertRaises(ValueError): self.build()
    def test_invalid_summary_and_empty_articles_rejected(self):
        self.payload['cited_by']['table'] = []
        with self.assertRaises(ValueError): self.build()
    def test_changes_can_increase_or_decrease(self):
        self.assertEqual(self.build(previous={'articles': [{'id': self.article['citation_id'], 'citations': 10}]})['articles'][0]['change'], 2)
        self.assertEqual(self.build(previous={'articles': [{'id': self.article['citation_id'], 'citations': 20}]})['articles'][0]['change'], -8)
    def test_unsafe_urls_and_malformed_counts(self):
        self.article['link'] = 'javascript:alert(1)'
        self.article['cited_by']['link'] = 'https://evil.example/x'
        self.article['cited_by']['value'] = -1
        a = self.build()['articles'][0]
        self.assertTrue(a['url'].startswith(m.PROFILE))
        self.assertIsNone(a['citingUrl']);self.assertIsNone(a['citations'])
        for value in [True, -1, 'N/A', 1.2]: self.assertIsNone(m.count(value))
    def test_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError): self.build([self.article, self.article])
    def test_first_seen_is_preserved(self):
        old = {'articles': [{'id': self.article['citation_id'], 'citations': 12, 'firstSeen': '2025-01-01'}]}
        self.assertEqual(self.build(previous=old)['articles'][0]['firstSeen'], '2025-01-01')

if __name__ == '__main__': unittest.main()
