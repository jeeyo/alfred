import Container from '../container';
import semver from 'semver';
import type DockerClient from '../dockerclient';

export default class Dotnet7 extends Container implements PackageManager {
  private buffer: string | null = null;

  constructor(
    protected docker: DockerClient,
    protected pwd?: string,
  ) {
    super(
      'mcr.microsoft.com/dotnet/sdk:7.0-alpine',
      ['/bin/sh', '-c'],
      ['dotnet list package --include-transitive'],
      docker,
      pwd,
      [],
    );
  }

  getName() {
    return 'dotnet7';
  }

  private async runIfHavent(): Promise<void> {
    if (this.buffer !== null) {
      return;
    }

    await this.run();
    this.buffer = this.getStdout().toString();
    console.log('buffer', this.buffer);
  }

  async getDependencies(): Promise<Record<string, string>> {
    await this.runIfHavent();

    const re = new RegExp(/> ([\w|\.]+)\s+([\w|\d|\.|-]+)\s+([\w|\d|\.|-]+)/gm);
    const matches = this.buffer!.matchAll(re);

    const dependencies: Record<string, string> = {};
    for (const match of matches) {
      const [, name, _, version] = match;
      dependencies[name] = version;
    }

    return dependencies;
  }

  async getTransitiveDependencies(): Promise<Record<string, string | null>> {
    await this.runIfHavent();

    const re = new RegExp(/  (├|└)─ (@?.*?)@(.*?)$/gm);
    const matches = this.buffer!.matchAll(re);

    const dependencies: Record<string, string | null> = {};
    for (const match of matches) {
      const [, , name, version] = match;
      dependencies[name] = semver.clean(version);
    }

    return dependencies;
  }
}
