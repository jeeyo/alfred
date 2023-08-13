import Container from '../container';
import DockerClient from '../dockerclient';

export default class GitLab extends Container {
  private buffer: string | null = null;
  protected command: string[] = ['glab'];

  constructor(
    protected docker: DockerClient,
    protected pwd?: string,
  ) {
    super('gitlab/glab:v1.31.0', ['/bin/sh', '-c'], ['glab'], docker, pwd, []);
  }

  async getVersion(): Promise<void> {
    this.flushStdout();
    this.command = ['glab', '-v'];
    await this.run();
    this.buffer = this.getStdout();
    console.log(this.buffer.toString());
  }
}
