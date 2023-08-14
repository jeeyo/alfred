import marked from 'marked';

const ALFRED_ISSUE_NAME = 'Alfred Dependency Manager';

export default class Issue {
  static from(
    title: string,
    description: string,
    state: 'opened' | 'closed',
  ): Issue | null {
    if (title !== ALFRED_ISSUE_NAME || state === 'closed') {
      return null;
    }

    return new Issue();
  }

  static parse(content: string): string {
    return marked.parse(content);
  }
}
