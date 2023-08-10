import cac from 'cac';

const cli = cac();

cli.option('--socket <socket>', 'Docker UNIX socket file path');

export default cli;
