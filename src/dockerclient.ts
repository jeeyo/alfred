import Docker from 'dockerode';
import { IncomingMessage } from 'http';

export interface DockerClientOptions {
  socketPath?: string;
}

export default class DockerClient {
  private readonly docker: Docker;

  constructor(protected options?: DockerClientOptions) {
    this.docker = new Docker(options);
  }

  async listImages(): Promise<string[][]> {
    const images = await this.docker.listImages();
    return images
      .map((image) => image.RepoTags ?? [])
      .filter((image) => image.length > 0);
  }

  async pull(image: string): Promise<void> {
    const message: IncomingMessage = await this.docker.pull(image);
    await new Promise((resolve, reject) => {
      message.on('close', () => {
        console.log('closed');
        resolve(true);
      });
      message.socket.on('close', (hadError) => hadError && reject());
    });
  }

  async run(
    image: string,
    entrypoint: string[],
    command: string[],
    pwd?: string,
    env?: string[],
    stdout?: NodeJS.WritableStream,
    stderr?: NodeJS.WritableStream,
  ): Promise<void> {
    // mount volume and set working dir if specified
    const volumeMount = pwd
      ? {
          HostConfig: {
            Binds: [`${pwd}:${pwd}`],
          },
          WorkingDir: pwd,
        }
      : {};

    const tty = stdout && stderr ? true : false;
    const streams = stdout && stderr ? [stdout, stderr] : stdout ? [stdout] : [];

    const [_, container] = (await this.docker.run(image, command ?? [], streams, {
      Tty: tty,
      Entrypoint: entrypoint,
      Env: env,
      ...volumeMount,
    })) as [any, Docker.Container];

    container.remove();
  }
}
