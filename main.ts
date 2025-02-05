import { Editor, MarkdownView, Notice, Plugin, TFile } from "obsidian";

import md5 from "md5";

async function computeMD5(buffer: ArrayBuffer): Promise<string> {
	return md5(new Uint8Array(buffer)); // Convert buffer to Uint8Array and hash it
}

export default class RenameAttachmentsToMD5Plugin extends Plugin {
	async onload() {
		this.addCommand({
			id: "rename-attachments-to-md5",
			name: "Rename attachments in current note to MD5 hash",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				await this.renameAttachmentsInCurrentNote(editor, view);
			},
		});
	}

	async renameAttachmentsInCurrentNote(editor: Editor, view: MarkdownView) {
		const file = view.file;
		if (!file) {
			new Notice("No active file found.");
			console.log("No active file found.");
			return;
		}

		const content = editor.getValue();
		//console.log("DEBUG: Current note content:", content);

		const attachmentRegex = /!\[\[([^|\]]+)(?:\|.*)?\]\]|!\[.*?\]\((.*?)\)/g;
		let match;
		let updatedContent = content;

		while ((match = attachmentRegex.exec(content)) !== null) {
			const attachmentPath = match[1] || match[2];
			console.log("Found attachment link:", attachmentPath);

			const attachmentFile = this.app.metadataCache.getFirstLinkpathDest(attachmentPath, file.path);

			if (attachmentFile instanceof TFile) {
				console.log("Located attachment file in vault:", attachmentFile.path);
				const attachmentData = await this.app.vault.readBinary(attachmentFile);
				const md5Hash = await computeMD5(attachmentData);
				const newFileName = `${md5Hash}.${attachmentFile.extension}`;

				if (newFileName !== attachmentFile.name) {
					const newPath = `${attachmentFile.parent?.path}/${newFileName}`.replace('//', '/');
					console.log(`Renaming ${attachmentFile.path} to ${newPath}`);
					await this.app.vault.rename(attachmentFile, newPath);
					// Update the link to include only the new filename
					updatedContent = updatedContent.replace(attachmentPath, newFileName);
				} else {
					console.log("attachment already named correctly, skipping:", attachmentFile.path);
				}
			} else {
				console.log("Could not locate attachment file for:", attachmentPath);
			}
		}

		if (updatedContent !== content) {
			editor.setValue(updatedContent);
			new Notice("Attachments renamed to MD5 hash.");

			console.log("Updated note content (diff):");

			// Output the changes in a diff-like format
			const contentLines = content.split('\n');
			const updatedContentLines = updatedContent.split('\n');

			for (let i = 0; i < contentLines.length; i++) {
				if (contentLines[i] !== updatedContentLines[i]) {
					console.log(`- ${contentLines[i]}`);
					console.log(`+ ${updatedContentLines[i]}`);
				}
			}
		} else {
			new Notice("No attachments found or renamed.");
			console.log("No attachments found or renamed.");
		}
	}
}
