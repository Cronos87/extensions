import { ActionPanel, Action, List, showToast, Toast, Icon, useNavigation, Detail } from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import Parser, { Enclosure, Item } from "rss-parser";

/** The Gamekult website url. */
export const websiteUrl = "https://www.gamekult.com";

/** Enum to determine where stores the news. */
enum Days {
  Today = "Aujourd'hui",
  Yesterday = "Hier",
  Before = "Précédent",
}

/** Type that describes an object of date and news items. */
type ItemsByDays = Record<Days, Item[]>;

/** Interface that describes the news state. */
interface NewsState {
  items: ItemsByDays;
  isLoading: boolean;
}

/** Interface that describes the props for the view details. */
interface NewsDetailsProps {
  title: string;
  content: string;
  link: string;
  creator?: string;
  enclosure?: Enclosure;
}

export default function Command() {
  const initialItemsState = { [Days.Today]: [], [Days.Yesterday]: [], [Days.Before]: [] };
  const [state, setState] = useState<NewsState>({
    items: initialItemsState,
    isLoading: true,
  });

  // Get the current and previous days.
  const todayDayNumber = new Date().getDate();
  const yesterdayDayNumber = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).getDate();

  /** Create the function to parse news. */
  const parseNews = useCallback(
    /** Parse the news and update the state. */
    async function parseNews() {
      // Instanciate the parse.
      const parser = new Parser();

      try {
        const result = await parser.parseURL(`${websiteUrl}/feed.xml`);
        const formattedDate: ItemsByDays = result.items.reduce((previous: ItemsByDays, current: Item) => {
          // Get the day from the news date.
          const date = new Date(current.isoDate || "");
          const day = date.getDate();

          // Insert the news...
          if (todayDayNumber === day) {
            previous[Days.Today].push(current);
          } else if (todayDayNumber - 1 === day || (todayDayNumber === 1 && yesterdayDayNumber === day)) {
            previous[Days.Yesterday].push(current);
          } else {
            previous[Days.Before].push(current);
          }

          return previous;
        }, initialItemsState);

        setState({
          items: formattedDate,
          isLoading: false,
        });
      } catch (error) {
        setState((oldState) => ({
          ...oldState,
          isLoading: false,
        }));

        showToast({ style: Toast.Style.Failure, title: "Could not parse news", message: String(error) });
      }
    },
    [setState]
  );

  useEffect(() => {
    parseNews();
  }, []);

  return (
    <List isLoading={state.isLoading} searchBarPlaceholder="Filter Gamekult news...">
      {Object.entries(state.items).map((data) => {
        const [day, items] = data;

        if (!items.length) return null;

        return (
          <List.Section key={day} title={day}>
            {items.map((item) => (
              <SearchListItem key={item.guid} item={item} />
            ))}
          </List.Section>
        );
      })}
    </List>
  );
}

function SearchListItem({ item }: { item: Item }) {
  const { push } = useNavigation();

  const title = item.title?.trim() || "No Title...";
  const link = item.link || websiteUrl;

  // Format the date.
  const date = new Date(item.isoDate || "");
  const day = ("0" + date.getDate()).slice(-2);
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const formattedDate = `${day}/${month}/${date.getUTCFullYear()}`;

  return (
    <List.Item
      title={title}
      accessoryTitle={formattedDate}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action
              title="Show Details"
              icon={Icon.Sidebar}
              onAction={() => push(<Details title={title} content={item.content || ""} link={link} {...item} />)}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.OpenInBrowser title="Open in Browser" url={link} shortcut={{ modifiers: ["cmd"], key: "enter" }} />
            <Action.CopyToClipboard title="Copy Link" content={link} shortcut={{ modifiers: ["cmd"], key: "." }} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function Details({ title, content, link, creator, enclosure }: NewsDetailsProps) {
  const markdown = `
# ${title}
${content}

${creator !== "" ? `Auteur : **${creator}**` : ""}

${enclosure ? `<img src="${enclosure.url}" />` : ""}
  `;

  return (
    <Detail
      navigationTitle={title}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open in Browser" url={link} />
          <Action.CopyToClipboard title="Copy Link" content={link} />
        </ActionPanel>
      }
    />
  );
}
