import marked from 'marked';

export default class IssueParser {
  parse(content: string): string {
    return marked.parse(content);
  }
}
