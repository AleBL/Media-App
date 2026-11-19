import type { CardView } from '@/stores/settings';

export type CardSize = Exclude<CardView, 'list'>;

/**
 * The narrowest card of a grid of each size (card-grid, style.css). A small
 * one fits three on a phone; a large one takes the whole phone.
 */
export const GRID_SIZE: Record<CardSize, string> = {
  small:
    '[--card-width:6.5rem] [--card-cap:calc((100%_-_2rem)/3)] sm:[--card-width:8.5rem]',
  medium: '',
  large: '[--card-width:18rem] [--card-cap:100%]',
};

/** The width of a card in a row that scrolls sideways, for each size. */
export const ROW_WIDTH: Record<CardSize, string> = {
  small: 'w-28 sm:w-32',
  medium: 'w-36 sm:w-40',
  large: 'w-44 sm:w-52',
};

/** A list shows its rows at the medium size. */
export const sizeOf = (view: CardView): CardSize =>
  view === 'list' ? 'medium' : view;
