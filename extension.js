const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const vscode = require('vscode');

const execFileAsync = promisify(execFile);
const SHA_RE = /\b[0-9a-f]{7,40}\b/gi;
const SHA_ONLY_RE = /^[0-9a-f]{4,64}$/i;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    vscode.window.registerTerminalLinkProvider({
      provideTerminalLinks(linkContext) {
        const links = [];
        SHA_RE.lastIndex = 0;
        let match;
        while ((match = SHA_RE.exec(linkContext.line)) !== null) {
          links.push({
            startIndex: match.index,
            length: match[0].length,
            tooltip: `Open ${match[0]} in Source Control`,
            sha: match[0],
            cwd: getTerminalCwd(linkContext.terminal),
          });
        }
        return links;
      },
      handleTerminalLink(link) {
        return openInSourceControl(link.sha, link.cwd);
      },
    }),
    vscode.commands.registerCommand('gitShaGraph.open', async (sha) => {
      const selected = vscode.window.activeTextEditor?.document.getText(
        vscode.window.activeTextEditor.selection,
      );
      const value =
        (typeof sha === 'string' && sha) ||
        (selected && SHA_ONLY_RE.test(selected.trim()) ? selected.trim() : undefined) ||
        (await vscode.window.showInputBox({
          prompt: 'Commit SHA',
          placeHolder: 'e.g. 1a2b3c4',
          validateInput: (input) =>
            SHA_ONLY_RE.test(input.trim()) ? undefined : 'Enter a git SHA',
        }));
      if (value) {
        await openInSourceControl(value.trim());
      }
    }),
  );
}

function deactivate() {}

/**
 * @param {vscode.Terminal} terminal
 */
function getTerminalCwd(terminal) {
  const integrationCwd = terminal.shellIntegration?.cwd?.fsPath;
  if (integrationCwd) {
    return integrationCwd;
  }
  const created = terminal.creationOptions?.cwd;
  if (typeof created === 'string') {
    return created;
  }
  return created?.fsPath;
}

/**
 * @param {string} sha
 * @param {string | undefined} preferredCwd
 */
async function openInSourceControl(sha, preferredCwd) {
  if (!SHA_ONLY_RE.test(sha)) {
    void vscode.window.showErrorMessage(`Not a git SHA: ${sha}`);
    return;
  }

  try {
    const repo = await resolveRepo(preferredCwd);
    const hash = (await git(repo, ['rev-parse', '--verify', `${sha}^{commit}`])).stdout.trim();

    await vscode.commands.executeCommand('workbench.view.scm');

    const uri = vscode.Uri.from({
      scheme: 'cursor.blame',
      path: `/commit/${hash}`,
      query: new URLSearchParams({ repoRoot: repo }).toString(),
    });

    try {
      await vscode.commands.executeCommand('vscode.open', uri);
    } catch {
      await vscode.commands.executeCommand('git.viewCommit', vscode.Uri.file(repo), hash);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Git SHA Graph: ${message}`);
  }
}

/**
 * @param {string | undefined} preferredCwd
 */
async function resolveRepo(preferredCwd) {
  const candidates = [];
  if (preferredCwd) {
    candidates.push(preferredCwd);
  }
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    candidates.push(folder.uri.fsPath);
  }

  const seen = new Set();
  for (const cwd of candidates) {
    if (!cwd || seen.has(cwd)) {
      continue;
    }
    seen.add(cwd);
    try {
      const { stdout } = await git(cwd, ['rev-parse', '--show-toplevel']);
      return stdout.trim();
    } catch {
      // try next workspace folder
    }
  }

  throw new Error('No git repository found for this terminal');
}

/**
 * @param {string} cwd
 * @param {string[]} args
 */
async function git(cwd, args) {
  try {
    return await execFileAsync('git', args, {
      cwd,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : '';
    throw new Error(stderr.trim() || (error instanceof Error ? error.message : 'git failed'));
  }
}

module.exports = { activate, deactivate };
