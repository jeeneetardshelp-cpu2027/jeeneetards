select
  current_database() as database_name,
  to_regclass('public.playlists') is not null as playlists_table_exists,
  to_regclass('public.videos') is not null as videos_table_exists,
  to_regclass('public.playlist_videos') is not null as playlist_videos_table_exists,
  to_regclass('public.playlist_ratings') is not null as playlist_ratings_table_exists,
  to_regclass('public.playlist_learning_goals') is not null
    as playlist_goals_table_exists,
  to_regclass('public.playlist_class_levels') is not null
    as playlist_classes_table_exists,
  to_regclass('public.video_learning_goals') is not null
    as video_goals_table_exists,
  to_regclass('public.video_class_levels') is not null
    as video_classes_table_exists,
  to_regclass('public.learning_goals') is not null as goals_table_exists,
  to_regclass('public.class_levels') is not null as classes_table_exists,
  to_regclass('public.chapters') is not null as chapters_table_exists,
  to_regprocedure('public.is_admin()') is not null as admin_function_exists,
  (
    select count(*) = 11
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'playlists'
      and column_name in (
        'id', 'title', 'teacher', 'youtube_playlist_id', 'channel_id',
        'category_id', 'subject_id', 'content_type', 'language',
        'difficulty', 'audience_focus'
      )
  ) as playlist_columns_exist,
  (
    select count(*) = 4
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'videos'
      and column_name in ('id', 'subject_id', 'category_id', 'chapter_id')
  ) as video_columns_exist;
