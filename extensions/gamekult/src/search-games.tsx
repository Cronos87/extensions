import { ActionPanel, Action, List, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useCallback, useRef } from "react";
import fetch, { AbortError } from "node-fetch";
import { parse } from "node-html-parser";
import { websiteUrl } from "./news";

interface SearchState {
  games: Game[];
  isLoading: boolean;
}

interface Game {
  id: string;
  title: string;
  url: string;
  company?: string;
  media: string[];
}

export default function Command() {
  const { state, search } = useSearch();

  return (
    <List isLoading={state.isLoading} onSearchTextChange={search} searchBarPlaceholder="Search games..." throttle>
      <List.Section title="Results" subtitle={state.games.length.toString()}>
        {state.games.map((game) => (
          <SearchListItem key={game.id} game={game} />
        ))}
      </List.Section>
    </List>
  );
}

function SearchListItem({ game }: { game: Game }) {
  return (
    <List.Item
      title={game.title}
      subtitle={game.company}
      accessories={[{ text: game.media.join(", ") }]}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open in Browser" url={game.url} />
          <Action.CopyToClipboard title="Copy URL" content={game.url} />
        </ActionPanel>
      }
    />
  );
}

function useSearch() {
  const [state, setState] = useState<SearchState>({ games: [], isLoading: true });
  const cancelRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async function search(searchText: string) {
      // Abort the current search and launch new one.
      cancelRef.current?.abort();
      cancelRef.current = new AbortController();

      // Trim the search text.
      const search = searchText.trim();

      // In case the user enter nothing, simply display no results.
      if (search === "") {
        setState({
          games: [],
          isLoading: false,
        });

        return;
      }

      setState((oldState) => ({
        ...oldState,
        isLoading: true,
      }));

      try {
        const response = await fetch(`https://www.gamekult.com/rechercher-jeu.html?q=${search.replaceAll(" ", "+")}`, {
          signal: cancelRef.current.signal,
        });
        const document = parse(await response.text());
        const gamesDetails = document.querySelectorAll(".pr__game-h__mdb__details");

        const games: Game[] = [];

        for (const [index, element] of gamesDetails.entries()) {
          const title = element.querySelector(".pr__game-h__mdb__details__title")?.text.trim() || "No Title...";
          const url = `${websiteUrl}${element.querySelector(":scope > a")?.getAttribute("href")}`;
          const company = element
            .querySelector(".pr__game-h__mdb__details__company")
            ?.textContent.trim()
            .replace(/\s\s+/g, " ")
            .split("par")
            .at(-1)
            ?.trim();
          const media = element.querySelectorAll(".pr__platform__tag--link").map((m) => m.textContent.trim());

          games.push({
            id: `${title}-${index}`,
            title,
            url,
            company,
            media,
          });
        }

        setState({
          games,
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
