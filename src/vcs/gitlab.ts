import DockerClient, { DockerClientOptions } from '../dockerclient';

export default class GitLab extends DockerClient {
  private buffer: string | null = null;
  protected command: string[] = ['glab'];

  constructor(
    protected pwd?: string,
    protected dockerOptions?: DockerClientOptions
  ) {
    super('gitlab/glab:v1.31.0', ['/bin/sh', '-c'], ['glab'], pwd, [], dockerOptions);
  }

  // private async runIfHavent(): Promise<void> {
  //   this.flushStdout();
  //   this.command = ['glab', 'version'];
  //   await this.run();
  //   this.buffer = this.getStdout();
  // }
}
