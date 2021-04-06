CREATE TABLE standards (
 id text UNIQUE,
 version smallint,
 description text,
 created_at date,
 pdf_file text,
 language text,
 type text
);
