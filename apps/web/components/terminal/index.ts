export { TerminalOutput } from "./TerminalOutput";
export { TerminalInput, focusTerminalInput } from "./TerminalInput";
export { AutocompleteDropdown } from "./AutocompleteDropdown";
export { TerminalShell } from "./TerminalShell";
export {
  createCoreCommands,
  executeCommand,
  parseCommand,
  getMatchingCommands,
  resolveCategory,
  makeLine,
  makeLines,
  type OutputLine,
  type OutputLineType,
  type CommandDef,
  type CommandResult,
  type CommandAction,
} from "./command-registry";
