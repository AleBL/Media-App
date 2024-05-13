export type Genre = {
  id: number;
  name: string;
};
  
export type Genres = {
  [language: string]: Genre[];
  getGenreNames?: (ids: number[], language: string) => string;
};

export type Logo = {
  href: string;
  imgSrc: string;
  imgAlt: string;
  version: string;
};
