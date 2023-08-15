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

    return new Issue(title, description, state);
  }

  private lexed: marked.TokensList | null = null;

  private constructor(
    private readonly title: string,
    private readonly description: string,
    private readonly state: 'opened' | 'closed',
  ) {
    this.lexed = marked.lexer(description);
  }

  getWorkspaces(): string[] {
    if (!this.lexed) {
      return [];
    }

    return (
      this.lexed
        .filter((l): l is marked.Tokens.Heading => l.type === 'heading')
        .filter((l) => l.depth === 3)
        // .filter((l) => fs.existsSync(l.text))  // TODO: verify that the path exists
        .map((l) => l.text) ?? []
    );
  }
}
