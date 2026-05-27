import { ReactNode } from 'react';
import { Button, Flex } from '@backstage/ui';
import { makeStyles } from '@material-ui/core';

/** @public */
export type ButtonTabItem<TKey extends string = string> = {
  key: TKey;
  label: ReactNode;
};

interface ButtonTabsProps<TKey extends string = string> {
  items: ButtonTabItem<TKey>[];
  value: TKey;
  onChange: (key: TKey) => void;
}

const useStyles = makeStyles(() => ({
  buttonFirst: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  buttonMiddle: {
    borderRadius: 0,
  },
  buttonLast: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
}));

/** @public */
export function ButtonTabs<TKey extends string = string>({
  items,
  value,
  onChange,
}: ButtonTabsProps<TKey>) {
  const classes = useStyles();

  return (
    <Flex gap="0" align="center">
      {items.map((item, index) => {
        const isActive = item.key === value;
        const isFirst = index === 0;
        const isLast = index === items.length - 1;
        const isSingle = isFirst && isLast;

        let className: string | undefined;
        if (!isSingle) {
          if (isFirst) className = classes.buttonFirst;
          else if (isLast) className = classes.buttonLast;
          else className = classes.buttonMiddle;
        }

        return (
          <Button
            key={item.key}
            variant={isActive ? 'primary' : 'secondary'}
            size="small"
            onClick={() => onChange(item.key)}
            aria-pressed={isActive}
            className={className}
          >
            {item.label}
          </Button>
        );
      })}
    </Flex>
  );
}
