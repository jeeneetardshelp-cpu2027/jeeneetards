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
  to_regclass('public.institutes_channels') is not null
    as channels_table_exists,
  to_regclass('public.categories') is not null as categories_table_exists,
  to_regclass('public.learning_goals') is not null as goals_table_exists,
  to_regclass('public.class_levels') is not null as classes_table_exists,
  to_regclass('public.chapters') is not null as chapters_table_exists,
  to_regprocedure('public.is_admin()') is not null as admin_function_exists,
  (
    select bool_and(exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = required.table_name
        and c.column_name = required.column_name
    ))
    from (
      values
        ('playlists', 'id'),
        ('playlists', 'title'),
        ('playlists', 'teacher'),
        ('playlists', 'youtube_playlist_id'),
        ('playlists', 'channel_id'),
        ('playlists', 'category_id'),
        ('playlists', 'subject_id'),
        ('playlists', 'content_type'),
        ('playlists', 'language'),
        ('playlists', 'difficulty'),
        ('playlists', 'audience_focus'),
        ('playlists', 'display_order'),
        ('playlists', 'class_levels'),
        ('videos', 'id'),
        ('videos', 'title'),
        ('videos', 'youtube_video_id'),
        ('videos', 'subject_id'),
        ('videos', 'category_id'),
        ('videos', 'chapter_id'),
        ('playlist_videos', 'id'),
        ('playlist_videos', 'playlist_id'),
        ('playlist_videos', 'video_id'),
        ('playlist_videos', 'position'),
        ('playlist_ratings', 'id'),
        ('playlist_ratings', 'playlist_id'),
        ('playlist_ratings', 'created_at'),
        ('playlist_learning_goals', 'playlist_id'),
        ('playlist_learning_goals', 'learning_goal_id'),
        ('playlist_class_levels', 'playlist_id'),
        ('playlist_class_levels', 'class_level_id'),
        ('video_learning_goals', 'video_id'),
        ('video_learning_goals', 'learning_goal_id'),
        ('video_class_levels', 'video_id'),
        ('video_class_levels', 'class_level_id'),
        ('institutes_channels', 'id'),
        ('institutes_channels', 'name'),
        ('categories', 'id'),
        ('categories', 'slug'),
        ('learning_goals', 'id'),
        ('learning_goals', 'slug'),
        ('learning_goals', 'display_order'),
        ('class_levels', 'id'),
        ('class_levels', 'slug'),
        ('class_levels', 'display_order'),
        ('chapters', 'id'),
        ('chapters', 'name'),
        ('chapters', 'subject_id')
    ) as required(table_name, column_name)
  ) as required_columns_exist;
