# npm-package-skeleton 🧱

A simple and powerful skeleton to kickstart your next NPM package.  
Designed to get out of your way and let you focus on building.  

> 🎯 Comes with built-in setup automation, GitHub workflows, author metadata, and more!

---

## 🚀 Quick Start

1. **Use the template**  
   Click the **[Use this template](https://github.com/HichemTab-tech/npm-package-skeleton/generate)** button on the GitHub page
   to create your own repo from this skeleton.

2. **Clone your new repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```

3. **Run the setup script**
   ```bash
   npm install
   npm run setup
   ```

4. **Answer the prompts**, and your package will be tailored to you:
   - Package name
   - Author info
   - GitHub username
   - Preferred package manager (`npm` or `pnpm`)
   - etc.

5. **Done!**  
   Your skeleton is now personalized, cleaned up, initialized with Git, and ready to code 🎸  
   **You can even publish to npm with a single GitHub release!**

## 📦 Publishing to npm

This skeleton comes with a preconfigured GitHub Action to automatically publish your package to [npmjs.com](https://www.npmjs.com/) whenever you create a GitHub release. 🎉

To enable it:

1. **Create an npm access token**:
    - Go to your [npm account tokens page](https://www.npmjs.com/settings/tokens).
    - Click **"Generate New Token"**.
    - Choose **"Automation"** (or **"Classic" with "Publish" access** if you prefer).
    - Copy the generated token.

2. **Add the token to your GitHub repo**:
    - Go to your repository on GitHub.
    - Navigate to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
    - Name it exactly: `NODE_AUTH_TOKEN`
    - Paste your token as the value.

3. **Publish your package**:
    - Push your changes to `main` (or your default branch).
    - Go to the **Releases** tab on GitHub.
    - Click **"Draft a new release"** and fill in the version/tag.
    - Once published, the GitHub Action will automatically publish your package to npm. 🚀

✅ That’s it! Now your releases will sync directly to npm with no extra steps.


---

## ✨ What's Included

- 🔁 Replaces placeholders with your custom info.
- 🧪 Ready-to-go structure.
- 🔧 GitHub Workflows:
    - Auto-assign issues
    - Dependabot support
    - ✅ **Publish to npm on GitHub release** (just create a release tag, and it’s live!)
- 📋 GitHub repo enhancements:
    - Issue templates for structured bug reports and feature requests.
    - Pull Request templates to encourage clear and detailed contributions.
- 🧹 Auto-cleans stub files and setup script after running.
- 💡 Package manager-based CI workflows (only keeps the one you need!).

---

## 📦 Why Use This?

Creating a new NPM package can be a chore:
- Configure GitHub flows ✅
- Clean project structure ✅
- Automate publishing ✅

Let this repo do all the boring stuff, so you can jump straight into the code.

---

## 🤝 Contribute

This is just the beginning.

There’s so much room to grow — from better GitHub automations (issue bots, release helpers) to richer setup options.

If you’ve got ideas, open a pull request or start a discussion — **contributions are super welcome!** 🌱

---

## 🌟 Support

If this helped you out,
please consider giving the repo a ⭐️ on [GitHub](https://github.com/HichemTab-tech/npm-package-skeleton) —
every bit of support means a lot!

---

## License

[MIT](./LICENSE)