import { describe, expect, it } from 'vitest';
import {
  projectView,
  type Project,
  type ProjectLabels,
  type ProjectsCopy,
} from '../../src/components/sections/projects-view';

const copy = {
  stack_label: 'Stack:',
  link_appstore: 'App Store',
  link_repo: 'Source code',
  link_live: 'Live site',
} as ProjectsCopy;

/** copy.yaml `labels` as shipped. */
const labels: ProjectLabels = {
  present: 'Present',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  year_month: '{month} {year}',
  list_separator: ', ',
  platform: { ios: 'iOS', web: 'Web', cli: 'CLI', research: 'Research' },
  status: {
    idea: 'idea',
    wip: 'in progress',
    testflight: 'TestFlight',
    shipped: 'shipped',
    completed: 'completed',
    archived: 'archived',
  },
};

const project = (over: Partial<Project> = {}): Project =>
  ({
    id: 'clock-stamp',
    title: 'Clock Stamp',
    status: 'shipped',
    platform: ['ios'],
    featured: true,
    year: 2026,
    stack: ['SwiftUI', 'MapKit'],
    links: {},
    ...over,
  }) as Project;

describe('projectView', () => {
  it('builds the card lines from one project', () => {
    const v = projectView(
      project({ role: 'Solo developer', location: 'Seattle', start: '2026-03', end: 'present' }),
      copy,
      labels,
    );
    expect(v).toMatchObject({
      anchor: 'project-clock-stamp',
      year: '2026',
      platforms: ['iOS'],
      status: 'shipped',
      stat: '2026 · iOS · shipped',
      when: 'Solo developer · Seattle · Mar 2026 – Present',
      stack: 'Stack: SwiftUI, MapKit',
      links: [],
    });
  });
  it('orders links App Store, live, repo, then the project’s own', () => {
    const v = projectView(
      project({
        links: {
          repo: 'https://github.com/x/y',
          live: 'https://x.y',
          appstore: 'https://apps.apple.com/app/id1',
          other: [{ label: 'Paper', url: 'https://x.y/paper.pdf' }],
        },
      }),
      copy,
      labels,
    );
    expect(v.links.map((l) => [l.kind, l.label])).toEqual([
      ['appstore', 'App Store'],
      ['live', 'Live site'],
      ['repo', 'Source code'],
      ['other', 'Paper'],
    ]);
  });
  it('leaves out what the project does not have', () => {
    const v = projectView(
      // The schema only allows known platforms; the label lookup still falls back safely.
      project({ stack: [], links: undefined, platform: ['web', 'zine'] as Project['platform'] }),
      copy,
      labels,
    );
    expect(v.when).toBeUndefined();
    expect(v.stack).toBeUndefined();
    expect(v.links).toEqual([]);
    // Unknown platforms are shown as written.
    expect(v.platforms).toEqual(['Web', 'zine']);
    // Only a start date (no end) is not a range.
    expect(projectView(project({ start: '2026-03' }), copy, labels).when).toBeUndefined();
  });
  it('takes its status words and "Present" from copy.yaml labels', () => {
    const v = projectView(project({ start: '2026-03', end: 'present' }), copy, {
      ...labels,
      present: 'ongoing',
      status: { ...labels.status, shipped: 'live' },
    });
    expect(v.status).toBe('live');
    expect(v.stat).toBe('2026 · iOS · live');
    expect(v.when).toBe('Mar 2026 – ongoing');
  });
  it('takes month words, platform words and the list separator from the page’s copy', () => {
    const v = projectView(
      project({ start: '2026-03', end: 'present', platform: ['ios', 'web'], stack: ['A', 'B'] }),
      { ...copy, stack_label: '技术栈：' },
      {
        ...labels,
        present: '至今',
        months: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
        year_month: '{year}年{month}',
        list_separator: '、',
        platform: { ...labels.platform, web: '网页' },
      },
    );
    expect(v.when).toBe('2026年3月 – 至今');
    expect(v.stat).toBe('2026 · iOS、网页 · shipped');
    expect(v.stack).toBe('技术栈： A、B');
  });
});
