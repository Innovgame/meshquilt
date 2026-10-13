import metadata from "../../../../packages/meshquilt/package.json";

export const version = metadata.version;
export const repositoryUrl = __REPOSITORY_URL__;
export const githubUrl = repositoryUrl || "https://github.com/search?q=meshquilt&type=repositories";

export function sourceUrl(path: string) {
    return repositoryUrl ? `${repositoryUrl}/blob/main/${path}` : githubUrl;
}
