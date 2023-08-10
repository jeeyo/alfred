import Docker from 'dockerode';
import { Writable, WritableOptions } from 'stream';
import { ClientRequest } from 'http';

class DockerClientStdioWritableStream extends Writable {
  private buffer = '';

  constructor(options?: WritableOptions) {
    super(options);
  }

  _write(
    chunk: any,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.buffer += chunk.toString();
    callback();
  }

  getBuffer(): string {
    return this.buffer;
  }

  flush(): void {
    this.buffer = '';
  }
}

export interface DockerClientOptions {
  socketPath?: string;
}

export default class DockerClient {
  private readonly docker: Docker;

  private stdout: DockerClientStdioWritableStream = new DockerClientStdioWritableStream();
  private stderr: DockerClientStdioWritableStream = new DockerClientStdioWritableStream();

  constructor(
    protected image: string,
    protected entrypoint: string[],
    protected command: string[],
    protected pwd?: string,
    protected env?: string[],
    protected dockerOptions?: DockerClientOptions,
  ) {
    this.docker = new Docker(dockerOptions);
  }

  private async checkImageExists(): Promise<boolean> {
    const images = await this.docker.listImages();
    return images.some((image) => image.RepoTags?.includes(this.image));
  }

  private async pull(): Promise<void> {
    if (await this.checkImageExists()) {
      console.log(`Image ${this.image} already exists, skipping pull...`);
      return;
    }

    console.log(`Pulling ${this.image}...`);
    const { socket }: { socket: ClientRequest } = await this.docker.pull(this.image);
    await new Promise((resolve, reject) => {
      socket.on('close', resolve);
      socket.on('error', reject);
    });
  }

  protected async run(): Promise<void> {
    await this.pull();

    console.log(`Running ${this.image}...`);

    // mount volume and set working dir if specified
    const volumeMount = this.pwd
      ? {
          HostConfig: {
            Binds: [`${this.pwd}:${this.pwd}`],
          },
          WorkingDir: this.pwd,
        }
      : {};

    const [_, container] = (await this.docker.run(
      this.image,
      this.command ?? [],
      [this.stdout, this.stderr],
      {
        Tty: false,
        Entrypoint: this.entrypoint,
        Env: this.env,
        ...volumeMount,
      },
    )) as [any, Docker.Container];

    container.remove();
  }

  protected getStdout(): string {
    return this.stdout.getBuffer();
  }

  protected getStderr(): string {
    return this.stderr.getBuffer();
  }

  protected flushStdout(): void {
    this.stdout.flush();
  }

  protected flushStderr(): void {
    this.stderr.flush();
  }
}
