import { ActionPanel, Action, List, showToast, Toast, Detail, Icon, useNavigation } from "@raycast/api";
import { useState, useEffect, useCallback, useRef } from "react";
import fetch, { AbortError } from "node-fetch";
import { parse } from "node-html-parser";
import { websiteUrl } from "./news";

interface SearchState {
  articles: Article[];
  isLoading: boolean;
}

interface Article {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  media?: string[];
  author: string;
}

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List isLoading={state.isLoading} onSearchTextChange={search} searchBarPlaceholder="Search articles..." throttle>
      <List.Section title="Results" subtitle={state.articles.length.toString()}>
        {state.articles.map((article) => (
          <SearchListItem key={article.id} article={article} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ article }: { article: Article }) {
  const { push } = useNavigation();

  return (
    <List.Item
      title={article.title}
      subtitle={article.category}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action title="Show Details" icon={Icon.Sidebar} onAction={() => push(<Details {...article} />)} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.OpenInBrowser
              title="Open in Browser"
              url={article.url}
              shortcut={{ modifiers: ["cmd"], key: "enter" }}
            />
            <Action.CopyToClipboard
              title="Copy URL"
              content={article.url}
              shortcut={{ modifiers: ["cmd"], key: "." }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function Details(article: Article) {
  const markdown = `
# ${article.title}

${article.description}

${article.media?.length ? `Supports : ${article.media.join(", ")}` : ''}

**${article.author}**
`;

  return (
    <Detail
      navigationTitle={article.title}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open in Browser" url={article.url} />
          <Action.CopyToClipboard title="Copy Link" content={article.url} />
        </ActionPanel>
      }
    />
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({ articles: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      // Abort the current search and launch new one.
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();

      // Trim the search text.
      const search = searchText.trim();

      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));

      try {
        const response = await fetch(`https://www.gamekult.com/rechercher.html?q=${search.replaceAll(" ", "+")}`, {
          signal: cancelRef.current.signal,
        });
        const document = parse(await response.text());
        const articlesDetails = document.querySelectorAll(".ed__news-h__sm");

        const articles: Article[] = [];

        for (const [index, element] of articlesDetails.entries()) {
          const linkElement = element.querySelector(".gk__helpers__fat-title-m a");

          const title = linkElement?.textContent.trim() || "No Title...";
          const description = element.querySelector(".gk__helpers__p")?.textContent.trim() || "";
          const url = `${websiteUrl}${linkElement?.getAttribute("href")}`;
          const category = element.querySelector(".gk__helpers__category")?.textContent.trim() || "";
          const media = element.querySelectorAll(".gk__helpers__tag").map((m) => m.textContent.trim());
          const author = element.querySelector(".gk__helpers__author")?.textContent.trim() || "";

          articles.push({
            id: `${title}-${index}`,
            title,
            description,
            url,
            category,
            media,
            author,
          });
        }

        setState({
          articles,
          isLoading: false,
        });
      } catch (error) {
        setState((oldState) => ({
          ...oldState,
          isLoading: false,
        }));

        if (error instanceof AbortError) {
          return;
        }

        console.error("search error", error);
        showToast({ style: Toast.Style.Failure, title: "Could not perform search", message: String(error) });
      }
    },
    [setState]
  );

  useEffect(() => {
    search("");
  }, []);

  return {
    state: state,
    search: search,
  };
}
