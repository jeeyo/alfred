import DockerClient from './dockerclient';

export interface ContainerOptions {
  client?: DockerClient;
}

export default class Container {
  private stdout: Buffer = Buffer.alloc(0);
  private stderr: Buffer = Buffer.alloc(0);

  constructor(
    protected image: string,
    protected entrypoint: string[],
    protected command: string[],
    protected docker: DockerClient,
    protected pwd?: string,
    protected env?: string[],
  ) {}

  private async checkImageExists(): Promise<boolean> {
    const images = await this.docker.listImages();
    return images.some((image) => image.includes(this.image));
  }

  private async pull(): Promise<void> {
    if (await this.checkImageExists()) {
      console.log(`Image ${this.image} already exists, skipping pull...`);
      return;
    }

    console.log(`Pulling ${this.image}...`);
    await this.docker.pull(this.image);
  }

  protected async run(): Promise<void> {
    await this.pull();

    console.log(`Running ${this.image}...`);
    [this.stdout, this.stderr] = await this.docker.run(
      this.image,
      this.entrypoint,
      this.command,
      this.pwd,
      this.env,
    );
  }

  protected getStdout(): Buffer {
    return this.stdout;
  }

  protected getStderr(): Buffer {
    return this.stderr;
  }

  protected flushStdout(): void {
    this.stdout = Buffer.alloc(0);
  }

  protected flushStderr(): void {
    this.stderr = Buffer.alloc(0);
  }
}
